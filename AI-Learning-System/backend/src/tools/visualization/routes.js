const express = require('express');
const router  = express.Router();
const service = require('./service');
const { requireLogin } = require('../../auth');

router.post('/generate', requireLogin, async (req, res, next) => {
  try {
    const { topic, kind } = req.body || {};
    const result = await service.generate({ topic, kind });
    if (!result.ok) {
      const map = {
        INVALID_TOPIC:     [400, 'Please provide a topic.'],
        AI_FAILED:         [503, 'The AI is temporarily unavailable.'],
        INVALID_AI_OUTPUT: [502, 'The AI returned an unusable response.'],
      };
      const [s, m] = map[result.code] || [400, 'Could not generate diagram.'];
      return res.status(s).json({ error: m, code: result.code });
    }
    res.status(201).json({ visualization: result.visualization });
  } catch (err) { next(err); }
});

module.exports = router;