const db     = require('../../db');
const logger = require('../../core/logger');
const { chat } = require('../../ai/gateway');
const { buildPracticePrompt } = require('./prompt');

const MAX_DESCRIPTION_LENGTH = 500;

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
  if (!Array.isArray(data.questions) || !data.questions.length) return 'No questions';
  for (let i = 0; i < data.questions.length; i++) {
    const q = data.questions[i];
    if (!q.question || typeof q.question !== 'string') return `Q${i+1} missing question`;
    if (!q.answer || typeof q.answer !== 'string') return `Q${i+1} missing answer`;
  }
  return null;
}

function cleanDescription(d) {
  if (d == null) return null;
  const s = String(d).trim();
  if (!s) return null;
  return s.slice(0, MAX_DESCRIPTION_LENGTH);
}

async function generate({ userId, topic, count = 5, difficulty = 'medium', subject = null, description = null }) {
  if (!topic || typeof topic !== 'string' || topic.trim().length < 2) {
    return { ok: false, code: 'INVALID_TOPIC' };
  }
  const safeCount = Math.max(1, Math.min(20, Number(count) || 5));
  const safeDiff = ['easy','medium','hard'].includes(difficulty) ? difficulty : 'medium';

  const systemPrompt = buildPracticePrompt({
    topic: topic.trim(), count: safeCount, difficulty: safeDiff, subject,
  });

  let aiResult;
  try {
    aiResult = await chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Generate the practice questions now. Return only JSON.' },
      ],
      temperature: 0.5,
      maxTokens: 2400,
    });
  } catch (err) {
    logger.error('[practice] AI failed:', err.message);
    return { ok: false, code: 'AI_FAILED' };
  }

  let parsed;
  try { parsed = parseJSON(aiResult.text); }
  catch (_) {
    logger.warn('[practice] JSON parse failed');
    return { ok: false, code: 'INVALID_AI_OUTPUT' };
  }

  const err = validate(parsed);
  if (err) return { ok: false, code: 'INVALID_AI_OUTPUT', detail: err };

  const set = await db.practice.createSet({
    userId,
    title: parsed.title || `Practice on ${topic}`,
    topic: topic.trim(),
    subject: subject || null,
    difficulty: safeDiff,
    description: cleanDescription(description),
  });

  await db.practice.addQuestions(set.id, parsed.questions.slice(0, safeCount));

  const full = await db.practice.findSet(set.id);
  return { ok: true, set: full };
}

module.exports = { generate };