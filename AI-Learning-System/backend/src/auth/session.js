// Session helpers and route guards.

const service = require('./service');

// Attach req.user if a session exists. Never blocks the request.
async function attachUser(req, res, next) {
  if (!req.session || !req.session.userId) {
    req.user = null;
    return next();
  }
  try {
    req.user = await service.getUserById(req.session.userId);
    if (!req.user) {
      // User was deleted but session persisted. Clean up.
      req.session.destroy(() => {});
    }
  } catch (err) {
    req.user = null;
  }
  next();
}

// Block the request if not logged in.
function requireLogin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// Block the request unless the user is an admin.
function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

// Open a session for a user.
function createSession(req, user) {
  req.session.userId = user.id;
}

// Close the current session.
function destroySession(req) {
  return new Promise((resolve) => {
    if (!req.session) return resolve();
    req.session.destroy(() => resolve());
  });
}

module.exports = {
  attachUser,
  requireLogin,
  requireAdmin,
  createSession,
  destroySession,
};