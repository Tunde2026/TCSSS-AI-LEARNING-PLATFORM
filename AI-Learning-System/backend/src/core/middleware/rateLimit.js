// ============================================================
// core/middleware/rateLimit.js
// ------------------------------------------------------------
// Uses ipKeyGenerator for IPv6-safe key generation.
// Falls back gracefully if req.ip is unavailable.
// ============================================================

const rateLimit = require('express-rate-limit');

// ipKeyGenerator is exported by express-rate-limit v7+
// Fall back to identity if not present (older versions).
let ipKeyGenerator = function (ip) { return ip; };
try {
  const m = require('express-rate-limit');
  if (typeof m.ipKeyGenerator === 'function') ipKeyGenerator = m.ipKeyGenerator;
} catch (_) {}

function safeKey(req) {
  let ip = req.ip;
  if (!ip && req.ips && req.ips.length) ip = req.ips[0];
  if (!ip && req.headers && req.headers['x-forwarded-for']) {
    ip = String(req.headers['x-forwarded-for']).split(',')[0].trim();
  }
  if (!ip && req.socket && req.socket.remoteAddress) ip = req.socket.remoteAddress;
  if (!ip) ip = 'unknown';
  // Normalize IPv6 through the library's helper so we don't trigger validation errors
  try {
    return ipKeyGenerator(ip);
  } catch (_) {
    return ip;
  }
}

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: safeKey,
  message: { error: 'Too many attempts. Please try again in a few minutes.' },
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: safeKey,
  message: { error: 'Too many requests. Please slow down.' },
});

module.exports = { authLimiter, apiLimiter };
