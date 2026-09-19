// ============================================================
// tools/mistakes/routes.js
// ------------------------------------------------------------
// Mistake Bank routes. Reads from quiz_attempts.
// ============================================================

const express = require('express');
const router  = express.Router();
const service = require('./service');
const { requireLogin } = require('../../auth');

// GET /api/tools/mistakes
router.get('/', requireLogin, async (req, res, next) => {
  try {
    const groups = await service.getMistakes(req.user.id);
    res.json({ groups });
  } catch (err) { next(err); }
});

module.exports = router;