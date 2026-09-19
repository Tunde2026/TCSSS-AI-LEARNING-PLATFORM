// ============================================================
// auth/session.js
// ------------------------------------------------------------
// Session helpers and route guards.
// Blocks suspended users on every request.
// ============================================================

const service = require('./service');

async function attachUser(req, res, next) {
  if (!req.session || !req.session.userId) {
    req.user = null;
    return next();
  }
  try {
    const user = await service.getUserById(req.session.userId);
    if (!user) {
      req.session.destroy(() => {});
      req.user = null;
      return next();
    }
    if (user.suspended) {
      req.session.destroy(() => {});
      req.user = null;
      return next();
    }
    req.user = user;
  } catch (err) {
    req.user = null;
  }
  next();
}

function requireLogin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  next();
}

function createSession(req, user) {
  req.session.userId = user.id;
}

function destroySession(req) {
  return new Promise((resolve) => {
    if (!req.session) return resolve();
    req.session.destroy(() => resolve());
  });
}

module.exports = {
  attachUser, requireLogin, requireAdmin,
  createSession, destroySession,
};