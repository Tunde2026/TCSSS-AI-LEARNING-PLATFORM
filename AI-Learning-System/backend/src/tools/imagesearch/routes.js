const express = require('express');
const router  = express.Router();
const service = require('./service');
const { requireLogin } = require('../../auth');

router.post('/search', requireLogin, async (req, res, next) => {
  try {
    const { query, count } = req.body || {};
    if (!service.isEnabled()) {
      return res.status(503).json({
        error: 'Image search is not configured. Add a Pexels API key in the admin panel.',
        code: 'NO_KEY',
      });
    }
    const result = await service.search(query, { count: count || 8 });
    if (!result.ok) {
      const map = {
        INVALID_QUERY: [400, 'Please describe what you are looking for.'],
        NO_KEY:        [503, 'Image search is not configured.'],
        NETWORK_ERROR: [503, 'The image service is temporarily unreachable.'],
        BAD_KEY:       [503, 'The Pexels API key is invalid.'],
        RATE_LIMITED:  [429, 'Image search is temporarily rate limited. Try again in a moment.'],
      };
      const entry = map[result.code] || [500, 'Could not search for images.'];
      return res.status(entry[0]).json({ error: entry[1], code: result.code });
    }
    res.json({ images: result.images });
  } catch (err) { next(err); }
});

module.exports = router;
