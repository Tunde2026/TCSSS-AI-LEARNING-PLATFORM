const express = require('express');
const router  = express.Router();
const service = require('./service');
const db      = require('../../db');
const { requireLogin } = require('../../auth');

// POST /api/tools/flashcards/generate
router.post('/generate', requireLogin, async (req, res, next) => {
  try {
    const { topic, count, subject, description } = req.body || {};
    const result = await service.generate({
      userId: req.user.id, topic, count, subject, description,
    });
    if (!result.ok) {
      const map = {
        INVALID_TOPIC:     [400, 'Please provide a topic.'],
        AI_FAILED:         [503, 'The AI is temporarily unavailable.'],
        INVALID_AI_OUTPUT: [502, 'The AI returned an unusable response.'],
      };
      const [s, m] = map[result.code] || [400, 'Could not generate flashcards.'];
      return res.status(s).json({ error: m, code: result.code });
    }
    res.status(201).json({ deck: result.deck });
  } catch (err) { next(err); }
});

// GET /api/tools/flashcards
router.get('/', requireLogin, async (req, res, next) => {
  try {
    const decks = await db.flashcards.listDecks(req.user.id);
    res.json({ decks });
  } catch (err) { next(err); }
});

// GET /api/tools/flashcards/:id
router.get('/:id', requireLogin, async (req, res, next) => {
  try {
    const deck = await db.flashcards.findDeck(req.params.id);
    if (!deck || deck.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Deck not found' });
    }
    res.json({ deck });
  } catch (err) { next(err); }
});

// PATCH /api/tools/flashcards/:id/description
router.patch('/:id/description', requireLogin, async (req, res, next) => {
  try {
    const description = (req.body && req.body.description != null)
      ? String(req.body.description).slice(0, 500)
      : null;
    const updated = await db.flashcards.setDescription(req.params.id, req.user.id, description);
    if (!updated) return res.status(404).json({ error: 'Deck not found' });
    res.json({ deck: updated });
  } catch (err) { next(err); }
});

// GET /api/tools/flashcards/:id/due
router.get('/:id/due', requireLogin, async (req, res, next) => {
  try {
    const deck = await db.flashcards.findDeck(req.params.id);
    if (!deck || deck.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Deck not found' });
    }
    const cards = await db.flashcards.dueCards(req.params.id, 100);
    res.json({ cards });
  } catch (err) { next(err); }
});

// POST /api/tools/flashcards/card/:cardId/review  { quality: 0|1|2|3 }
router.post('/card/:cardId/review', requireLogin, async (req, res, next) => {
  try {
    const quality = Number(req.body && req.body.quality);
    if (![0,1,2,3].includes(quality)) {
      return res.status(400).json({ error: 'quality must be 0, 1, 2, or 3' });
    }
    const updated = await db.flashcards.reviewCard({
      cardId: req.params.cardId,
      userId: req.user.id,
      quality,
    });
    if (!updated) return res.status(404).json({ error: 'Card not found' });
    res.json({ card: updated });
  } catch (err) { next(err); }
});

// DELETE /api/tools/flashcards/:id
router.delete('/:id', requireLogin, async (req, res, next) => {
  try {
    const ok = await db.flashcards.removeDeck(req.params.id, req.user.id);
    if (!ok) return res.status(404).json({ error: 'Deck not found' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;