const express = require('express');
const router = express.Router();
const service = require('./service');
const { BADGES } = require('./definitions');

function requireLogin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  next();
}

router.get('/me', requireLogin, async (req, res, next) => {
  try {
    // Record today's activity (idempotent) and check for new badges
    await service.recordActivity(req.user.id, 'session');
    const awarded = await service.checkAndAward(req.user.id);
    const overview = await service.getOverview(req.user.id);
    res.json(Object.assign({}, overview, { newly_awarded: awarded }));
  } catch (err) { next(err); }
});

router.get('/catalog', requireLogin, async (req, res, next) => {
  try {
    const catalog = Object.keys(BADGES).map(function (key) {
      return Object.assign({ key: key }, BADGES[key]);
    });
    res.json({ badges: catalog });
  } catch (err) { next(err); }
});

module.exports = router;
