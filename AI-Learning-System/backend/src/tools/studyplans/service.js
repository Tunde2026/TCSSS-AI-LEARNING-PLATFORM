const db     = require('../../db');
const logger = require('../../core/logger');
const { chat } = require('../../ai/gateway');
const { buildStudyPlanPrompt } = require('./prompt');

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

function validate(data, days) {
  if (!data || typeof data !== 'object') return 'Not an object';
  if (!Array.isArray(data.days) || !data.days.length) return 'No days';
  for (let i = 0; i < data.days.length; i++) {
    const d = data.days[i];
    if (!d.title || typeof d.title !== 'string') return `Day ${i+1} missing title`;
    if (!Array.isArray(d.tasks) || !d.tasks.length) return `Day ${i+1} has no tasks`;
  }
  return null;
}

function cleanDescription(d) {
  if (d == null) return null;
  const s = String(d).trim();
  if (!s) return null;
  return s.slice(0, MAX_DESCRIPTION_LENGTH);
}

async function generate({ userId, topic, days = 7, subject, examDate, description = null }) {
  if (!topic || typeof topic !== 'string' || topic.trim().length < 2) {
    return { ok: false, code: 'INVALID_TOPIC' };
  }
  const safeDays = Math.max(3, Math.min(30, Number(days) || 7));

  const systemPrompt = buildStudyPlanPrompt({
    topic: topic.trim(), days: safeDays, subject, examDate,
  });

  let aiResult;
  try {
    aiResult = await chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Generate the study plan now. Return only JSON.' },
      ],
      temperature: 0.5,
      maxTokens: 3000,
    });
  } catch (err) {
    logger.error('[studyplans] AI failed:', err.message);
    return { ok: false, code: 'AI_FAILED' };
  }

  let parsed;
  try { parsed = parseJSON(aiResult.text); }
  catch (_) { return { ok: false, code: 'INVALID_AI_OUTPUT' }; }

  const err = validate(parsed, safeDays);
  if (err) return { ok: false, code: 'INVALID_AI_OUTPUT', detail: err };

  const today = new Date().toISOString().slice(0, 10);

  const plan = await db.studyPlans.create({
    userId,
    title: parsed.title || `${safeDays}-day plan for ${topic}`,
    topic: topic.trim(),
    subject: subject || null,
    durationDays: safeDays,
    startDate: today,
    plan: { days: parsed.days.slice(0, safeDays) },
    description: cleanDescription(description),
  });

  return { ok: true, plan };
}

module.exports = { generate };