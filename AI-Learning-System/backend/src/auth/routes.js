const express = require('express');
const router  = express.Router();
const service = require('./service');
const session = require('./session');
const logger  = require('../core/logger');
const { authLimiter } = require('../core/middleware/rateLimit');

// ---- Validation helpers ----
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateSignup(body) {
  const { name, email, password } = body || {};
  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    return 'Please enter your full name.';
  }
  if (!email || !EMAIL_RE.test(email)) {
    return 'Please enter a valid email address.';
  }
  if (!password || typeof password !== 'string' || password.length < 8) {
    return 'Password must be at least 8 characters.';
  }
  return null;
}

function validateLogin(body) {
  const { email, password } = body || {};
  if (!email || !password) return 'Email and password are required.';
  return null;
}

// ---- POST /api/auth/signup ----
router.post('/signup', authLimiter, async (req, res, next) => {
  try {
    const error = validateSignup(req.body);
    if (error) return res.status(400).json({ error });

    const { name, email, password } = req.body;
    const result = await service.signup({ name: name.trim(), email, password });

    if (!result.ok) {
      if (result.code === 'EMAIL_TAKEN') {
        return res.status(409).json({
          error: 'An account with that email already exists.',
          code: 'EMAIL_TAKEN',
        });
      }
    }

    session.createSession(req, result.user);
    res.status(201).json({ ok: true, user: result.user });

  } catch (err) {
    next(err);
  }
});

// ---- POST /api/auth/login ----
router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const error = validateLogin(req.body);
    if (error) return res.status(400).json({ error });

    const { email, password } = req.body;
    const result = await service.login({ email, password });

    if (!result.ok) {
      if (result.code === 'NO_ACCOUNT') {
        return res.status(404).json({
          error: 'No account found with that email.',
          code: 'NO_ACCOUNT',
        });
      }
      if (result.code === 'BAD_CREDENTIALS') {
        return res.status(401).json({
          error: 'Incorrect password.',
          code: 'BAD_CREDENTIALS',
        });
      }
    }

    session.createSession(req, result.user);
    res.json({ ok: true, user: result.user });

  } catch (err) {
    next(err);
  }
});

// ---- POST /api/auth/logout ----
router.post('/logout', async (req, res, next) => {
  try {
    await session.destroySession(req);
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ---- GET /api/auth/me ----
router.get('/me', session.requireLogin, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;