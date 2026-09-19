const db      = require('../../db');
const logger  = require('../../core/logger');
const { chat } = require('../../ai');
const { buildFlashcardPrompt } = require('./prompt');

function parseJSON(raw) {
  let text = String(raw).trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  const first = text.indexOf('{');
  const last  = text.lastIndexOf('}');
  if (first > 0 || last !== text.length - 1) {
    if (first !== -1 && last !== -1) text = text.slice(first, last + 1);
  }
  return JSON.parse(text);
}

function validate(data) {
  if (!data || typeof data !== 'object') return 'Not an object';
  if (!Array.isArray(data.cards) || data.cards.length === 0) return 'No cards';
  for (let i = 0; i < data.cards.length; i++) {
    const c = data.cards[i];
    if (!c.front || typeof c.front !== 'string') return `Card ${i+1} missing front`;
    if (!c.back  || typeof c.back  !== 'string') return `Card ${i+1} missing back`;
  }
  return null;
}

async function generate({ userId, topic, count = 10, subject = null }) {
  if (!topic || typeof topic !== 'string' || topic.trim().length < 2) {
    return { ok: false, code: 'INVALID_TOPIC' };
  }
  const safeCount = Math.max(1, Math.min(30, Number(count) || 10));

  const systemPrompt = buildFlashcardPrompt({
    topic: topic.trim(), count: safeCount, subject,
  });

  let aiResult;
  try {
    aiResult = await chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: 'Generate the flashcards now. Return only JSON.' },
      ],
      temperature: 0.5,
      maxTokens: 2048,
    });
  } catch (err) {
    logger.error('[flashcards] AI call failed:', err.message);
    return { ok: false, code: 'AI_FAILED' };
  }

  let parsed;
  try { parsed = parseJSON(aiResult.text); }
  catch (err) {
    logger.warn('[flashcards] JSON parse failed. First 200 chars:', aiResult.text.slice(0, 200));
    return { ok: false, code: 'INVALID_AI_OUTPUT' };
  }

  const err = validate(parsed);
  if (err) return { ok: false, code: 'INVALID_AI_OUTPUT', detail: err };

  const deck = await db.flashcards.createDeck({
    userId,
    title: parsed.title || `Flashcards on ${topic}`,
    topic: topic.trim(),
    subject: subject || null,
  });

  await db.flashcards.addCards(deck.id, parsed.cards.slice(0, safeCount));

  const full = await db.flashcards.findDeck(deck.id);
  return { ok: true, deck: full };
}

module.exports = { generate };