const express = require('express');
const router  = express.Router();
const service = require('./service');
const { requireLogin } = require('../../auth');

router.post('/generate', requireLogin, async (req, res, next) => {
  try {
    const { prompt, model, width, height, seed } = req.body || {};
    const result = await service.generate({ prompt, model, width, height, seed });
    if (!result.ok) {
      const map = {
        INVALID_PROMPT: [400, 'Please describe what you want the image to show.'],
        NETWORK_ERROR:  [503, 'The image service is temporarily unreachable.'],
        EMPTY_IMAGE:    [502, 'The image service returned an empty image.'],
      };
      const entry = map[result.code] || [500, 'Could not generate the image.'];
      return res.status(entry[0]).json({ error: entry[1], code: result.code });
    }
    res.status(201).json({ image: result.image });
  } catch (err) { next(err); }
});

module.exports = router;
