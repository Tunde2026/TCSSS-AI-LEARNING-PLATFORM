const express = require('express');
const { requireAdmin } = require('../core');

const router = express.Router();

router.get('/upload', requireAdmin, (req, res) => {
  // TODO: admin-only route for uploading resources.
  res.status(501).json({ error: 'Not implemented' });
});

router.get('/items', requireAdmin, (req, res) => {
  // TODO: admin-only route for listing resources.
  res.status(501).json({ error: 'Not implemented' });
});

module.exports = router;
