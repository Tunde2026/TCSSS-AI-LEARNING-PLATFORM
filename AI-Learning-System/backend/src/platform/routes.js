const express = require('express');
const router = express.Router();
const giphy = require('./giphy');
const core = require('../core');

router.get('/gif', async (req, res, next) => {
  try {
    const query = req.query.q ||
      await core.settings.getSetting('platform.demo_gif_query', 'education studying');
    const limit = req.query.limit || 12;
    const result = await giphy.searchRandom(query, limit);
    if (!result.ok) {
      if (result.code === 'NO_KEY') {
        return res.status(503).json({ error: 'Giphy is not configured.', code: result.code });
      }
      return res.status(502).json({ error: 'Could not load animation.', code: result.code });
    }
    res.json({ gif: result.gif, query: query });
  } catch (err) { next(err); }
});

module.exports = router;
