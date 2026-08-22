const express = require('express');
const crypto = require('crypto');
const supabase = require('../lib/supabase');
const { sendVerificationEmail } = require('../lib/email');

const router = express.Router();

// POST /auth/send-verification-email
router.post('/send-verification-email', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Generate verification token (24 hour expiry)
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Update user with verification token
    const { error } = await supabase
      .from('users')
      .update({
        verification_token: verificationToken,
        verification_token_expires: expiresAt.toISOString(),
      })
      .eq('email', email);

    if (error) {
      return res.status(500).json({ error: 'Failed to update user' });
    }

    // Send verification email
    await sendVerificationEmail(email, verificationToken);

    res.json({ success: true, message: 'Verification email sent' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to send verification email' });
  }
});

// POST /auth/verify-email
router.post('/verify-email', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    // Find user with this token
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('verification_token', token)
      .single();

    if (error || !data) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    // Check if token is expired
    if (new Date(data.verification_token_expires) < new Date()) {
      return res.status(400).json({ error: 'Token has expired' });
    }

    // Mark email as verified
    const { error: updateError } = await supabase
      .from('users')
      .update({
        email_verified: true,
        verification_token: null,
        verification_token_expires: null,
      })
      .eq('id', data.id);

    if (updateError) {
      return res.status(500).json({ error: 'Failed to verify email' });
    }

    res.json({ success: true, message: 'Email verified successfully' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to verify email' });
  }
});

module.exports = router;
