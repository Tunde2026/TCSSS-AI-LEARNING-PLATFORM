// ============================================================
// agents/routes.js
// ------------------------------------------------------------
// Custom @AI agent routes. All require login.
//
// IMPORTANT: static routes like "/meta/options" MUST be defined
// BEFORE dynamic routes like "/:id", or Express will match
// "meta" as an id value.
// ============================================================

const express = require('express');
const router  = express.Router();
const service = require('./service');
const { requireLogin } = require('../auth');

// ---------------- Static routes (must come first) ----------------

// GET /api/agents/meta/options — the tool list and level list for the UI
router.get('/meta/options', requireLogin, (req, res) => {
  res.json({
    tools:  service.VALID_TOOLS,
    levels: service.VALID_LEVELS,
  });
});

// ---------------- Collection routes ----------------

// GET /api/agents — list the current user's agents
router.get('/', requireLogin, async (req, res, next) => {
  try {
    const agents = await service.list(req.user.id);
    res.json({ agents });
  } catch (err) { next(err); }
});

// POST /api/agents — create a new agent
router.post('/', requireLogin, async (req, res, next) => {
  try {
    const result = await service.create(req.user.id, req.body || {});

    if (!result.ok) {
      const map = {
        INVALID:    [400, result.detail || 'Invalid agent data.'],
        NAME_TAKEN: [409, 'You already have an AI with that name.'],
      };
      const [status, msg] = map[result.code] || [400, 'Could not create agent.'];
      return res.status(status).json({ error: msg, code: result.code });
    }

    res.status(201).json({ agent: result.agent });
  } catch (err) { next(err); }
});

// ---------------- Single-item routes ----------------

// GET /api/agents/:id
router.get('/:id', requireLogin, async (req, res, next) => {
  try {
    const agent = await service.get(req.user.id, req.params.id);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    res.json({ agent });
  } catch (err) { next(err); }
});

// PATCH /api/agents/:id
router.patch('/:id', requireLogin, async (req, res, next) => {
  try {
    const result = await service.update(req.user.id, req.params.id, req.body || {});

    if (!result.ok) {
      const map = {
        INVALID:    [400, result.detail || 'Invalid agent data.'],
        NAME_TAKEN: [409, 'You already have an AI with that name.'],
        NOT_FOUND:  [404, 'Agent not found.'],
      };
      const [status, msg] = map[result.code] || [400, 'Could not update agent.'];
      return res.status(status).json({ error: msg, code: result.code });
    }

    res.json({ agent: result.agent });
  } catch (err) { next(err); }
});

// DELETE /api/agents/:id
router.delete('/:id', requireLogin, async (req, res, next) => {
  try {
    const result = await service.remove(req.user.id, req.params.id);
    if (!result.ok) return res.status(404).json({ error: 'Agent not found' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;