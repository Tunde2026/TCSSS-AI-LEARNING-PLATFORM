// Thin re-export so core/index.js can expose guards without
// creating a circular dependency with the auth module.

module.exports = {
  requireLogin: (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    next();
  },
  requireAdmin: (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    next();
  },
};