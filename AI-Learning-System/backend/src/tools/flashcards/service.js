// ============================================================
// tools/flashcards/service.js
// ------------------------------------------------------------
// Business logic for Flashcards. AI generates candidate cards;
// the app validates and stores them.
// ============================================================

const db      = require('../../db');
const logger  = require('../../core/logger');
const { chat } = require('../../ai/gateway');
const { buildFlashcardPrompt } = require('./prompt');

const MAX_CARDS = 50;
const MAX_DESCRIPTION_LENGTH = 500;

/* ------------------------------------------------------------
   JSON parsing — strips markdown fences if the AI adds them
   ------------------------------------------------------------ */
function parseJSON(raw) {
  let text = String(raw).trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  const firstBrace = text.indexOf('{');
  const lastBrace  = text.lastIndexOf('}');
  if (firstBrace > 0 || lastBrace !== text.length - 1) {
    if (firstBrace !== -1 && lastBrace !== -1) {
      text = text.slice(firstBrace, lastBrace + 1);
    }
  }
  return JSON.parse(text);
}

/* ------------------------------------------------------------
   Validation — every card must have a front and a back
   ------------------------------------------------------------ */
function validateDeck(data) {
  if (!data || typeof data !== 'object') return 'Response is not an object';
  if (!Array.isArray(data.cards) || data.cards.length === 0) return 'Response has no cards';
  for (let i = 0; i < data.cards.length; i++) {
    const c = data.cards[i];
    if (!c || typeof c.front !== 'string' || !c.front.trim()) return `Card ${i + 1} missing front`;
    if (typeof c.back !== 'string' || !c.back.trim()) return `Card ${i + 1} missing back`;
    if (c.front.length > 400) return `Card ${i + 1} front is too long`;
    if (c.back.length  > 800) return `Card ${i + 1} back is too long`;
  }
  return null;
}

/* ------------------------------------------------------------
   Normalize description
   ------------------------------------------------------------ */
function cleanDescription(d) {
  if (d == null) return null;
  const s = String(d).trim();
  if (!s) return null;
  return s.slice(0, MAX_DESCRIPTION_LENGTH);
}

/* ------------------------------------------------------------
   Generate — ask AI, validate, save
   ------------------------------------------------------------ */
async function generate({ userId, topic, count = 10, subject = null, description = null }) {
  if (!topic || typeof topic !== 'string' || topic.trim().length < 2) {
    return { ok: false, code: 'INVALID_TOPIC' };
  }

  const safeCount = Math.max(1, Math.min(MAX_CARDS, Number(count) || 10));
  const cleanTopic = topic.trim();
  const cleanDesc  = cleanDescription(description);

  const systemPrompt = buildFlashcardPrompt({
    topic: cleanTopic,
    count: safeCount,
    subject,
  });

  let aiResult;
  try {
    aiResult = await chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Generate the flashcards now. Return only the JSON.' },
      ],
      temperature: 0.6,
      maxTokens: 2048,
    });
  } catch (err) {
    logger.error('[flashcards] AI call failed:', err.message);
    return { ok: false, code: 'AI_FAILED' };
  }

  let parsed;
  try { parsed = parseJSON(aiResult.text); }
  catch (_) { return { ok: false, code: 'INVALID_AI_OUTPUT' }; }

  const validationError = validateDeck(parsed);
  if (validationError) {
    return { ok: false, code: 'INVALID_AI_OUTPUT', detail: validationError };
  }

  const deck = await db.flashcards.createDeck({
    userId,
    title: parsed.title || `Flashcards on ${cleanTopic}`,
    topic: cleanTopic,
    subject: subject || null,
    description: cleanDesc,
  });

  const cards = parsed.cards.slice(0, safeCount).map(function (c) {
    return {
      front: c.front.trim(),
      back:  c.back.trim(),
    };
  });

  await db.flashcards.addCards(deck.id, cards);
  const full = await db.flashcards.findDeck(deck.id);
  return { ok: true, deck: full };
}

module.exports = { generate };