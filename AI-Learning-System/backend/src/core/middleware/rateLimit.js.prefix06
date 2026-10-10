const rateLimit = require('express-rate-limit');

// Limits authentication attempts (signup/login) to prevent brute force.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,       // 15 minutes
  max: 20,                        // 20 attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again in a few minutes.' },
});

// General API limiter. Applied to /api/* routes.
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,            // 1 minute
  max: 60,                        // 60 requests per IP per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
});

module.exports = { authLimiter, apiLimiter };