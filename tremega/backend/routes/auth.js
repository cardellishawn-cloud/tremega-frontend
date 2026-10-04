const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const supabase = require('../lib/supabase');
const authMiddleware = require('../middleware/auth');
const otpStore = null; // legacy custom-OTP store — superseded by Twilio Verify
const userStore = require('../src/services/user-store');
const twilio = require('../src/services/twilio-service');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRY = '7d';

// POST /api/auth/register
router.post('/register', [
  body('email').isEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('full_name').trim().notEmpty().withMessage('Full name required'),
  body('role').optional().isIn(['admin', 'contractor', 'sub', 'client']).withMessage('Invalid role'),
  body('company_name').optional().trim(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, full_name, role, company_name } = req.body;

    // Check if email already exists
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Insert user
    const { data: user, error } = await supabase
      .from('users')
      .insert({
        email,
        password_hash,
        full_name,
        role: role || 'client',
        company_name: company_name || null,
      })
      .select('id, email, full_name, role')
      .single();

    if (error) throw error;

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    res.status(201).json({
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      token,
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', [
  body('email').isEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Find user
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, full_name, role, password_hash, is_active')
      .eq('email', email)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (user.is_active === false) {
      return res.status(403).json({ error: 'Account is deactivated' });
    }

    // Verify password
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    res.json({
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.json({ message: 'logged out' });
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, full_name, role, company_name, created_at')
      .eq('id', req.user.userId)
      .single();

    if (error || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Me error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    // Verify the refresh token (we accept valid JWTs even if expired for refresh)
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        // Allow expired tokens for refresh — decode without verifying expiry
        decoded = jwt.decode(refreshToken);
        if (!decoded || !decoded.userId) {
          return res.status(401).json({ error: 'Invalid refresh token' });
        }
      } else {
        return res.status(401).json({ error: 'Invalid refresh token' });
      }
    }

    // Verify user still exists and is active
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, role, is_active')
      .eq('id', decoded.userId)
      .single();

    if (error || !user || user.is_active === false) {
      return res.status(401).json({ error: 'User not found or deactivated' });
    }

    // Generate new JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    res.json({ token });
  } catch (error) {
    console.error('Refresh error:', error);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

// ---------- SMS OTP login (field workers) ----------

const E164 = /^\+[1-9]\d{6,14}$/;

// POST /api/auth/otp/send
// Body: { phone: '+15551234567' }. Twilio Verify generates + delivers the
// code (10-min expiry, built-in rate limits, no A2P registration needed).
router.post('/otp/send', [
  body('phone').matches(E164).withMessage('Phone must be E.164 format (+15551234567)'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { phone } = req.body;

    if (!twilio.isVerifyConfigured()) {
      return res.json({ sent: false, reason: 'sms_unconfigured', message: 'SMS is not configured on this server' });
    }

    try {
      const verification = await twilio.sendVerification(phone);
      return res.json({ sent: true, status: verification.status, message: 'OTP sent' });
    } catch (err) {
      return res.status(502).json({ error: 'Failed to send SMS', reason: err.message });
    }
  } catch (error) {
    console.error('OTP send error:', error);
    return res.status(500).json({ error: 'OTP send failed' });
  }
});

// POST /api/auth/otp/verify
// Body: { phone, code }. On success: JWT + user profile (same shape as /login).
router.post('/otp/verify', [
  body('phone').matches(E164).withMessage('Phone must be E.164 format (+15551234567)'),
  body('code').isLength({ min: 6, max: 6 }).isNumeric().withMessage('6-digit code required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { phone, code } = req.body;

    if (!twilio.isVerifyConfigured()) {
      return res.status(503).json({ error: 'SMS verification is not configured on this server' });
    }

    let check;
    try {
      check = await twilio.checkVerification(phone, code);
    } catch (err) {
      // e.g. 20404 — no pending verification or code expired.
      return res.status(401).json({ error: 'Invalid or expired code' });
    }
    if (check.status !== 'approved') {
      return res.status(401).json({ error: 'Invalid or expired code' });
    }

    // No self-signup: the owner must have created this account already.
    const user = await userStore.findByPhone(phone);
    if (!user) {
      return res.status(403).json({ error: 'No account found for this phone number. Contact your administrator.' });
    }
    if (user.is_active === false) {
      return res.status(403).json({ error: 'Account is deactivated' });
    }

    const userPhone = user.phone || user.phone_number || user.phone_e164 || phone;
    const token = jwt.sign(
      { userId: user.id, email: user.email || null, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email || null,
        full_name: user.full_name || null,
        role: user.role,
        phone: userPhone,
      },
    });
  } catch (error) {
    console.error('OTP verify error:', error);
    return res.status(500).json({ error: 'OTP verify failed' });
  }
});

module.exports = router;
