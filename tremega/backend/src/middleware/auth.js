// src/middleware/auth.js
// JWT verification middleware.
// Extracts token from Authorization header, verifies signature, sets req.user.

const crypto = require('crypto');

const verifyJWT = (token, secret) => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Invalid token format');

    const [headerB64, payloadB64, signatureB64] = parts;
    const message = headerB64 + '.' + payloadB64;

    // Verify signature
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(message)
      .digest('base64url');

    if (signatureB64 !== expectedSig) {
      throw new Error('Signature verification failed');
    }

    // Decode payload
    const payloadJson = Buffer.from(payloadB64, 'base64url').toString('utf8');
    const payload = JSON.parse(payloadJson);

    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      throw new Error('Token expired');
    }

    return payload;
  } catch (err) {
    throw new Error('Invalid token: ' + err.message);
  }
};

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const token = authHeader.substring(7);
  try {
    const payload = verifyJWT(token, process.env.JWT_SECRET);
    req.user = payload;
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

module.exports = authMiddleware;
