const express = require('express');
const { requireAdmin } = require('../core');

const router = express.Router();

// All admin routes must use the core requireAdmin middleware.
router.get('/dashboard', requireAdmin, (req, res) => {
  // TODO: render or return the admin dashboard summary.
  res.status(501).json({ error: 'Not implemented' });
});

router.get('/system', requireAdmin, (req, res) => {
  // TODO: list system health or operational metrics.
  res.status(501).json({ error: 'Not implemented' });
});

module.exports = router;
