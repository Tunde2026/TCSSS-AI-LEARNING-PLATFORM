const express = require('express');
const router = express.Router();
const giphy = require('./giphy');

// Public route — no auth required for the hero background
router.get('/hero-video', async (req, res, next) => {
  try {
    const r = await giphy.pickHeroVideo();
    res.json(r);
  } catch (err) { next(err); }
});

// Optional: return several options (for admin picker later)
router.get('/hero-videos', async (req, res, next) => {
  try {
    const r = await giphy.fetchVideos(12);
    res.json(r);
  } catch (err) { next(err); }
});

module.exports = router;
