const logger = require('../../core/logger');
const { chat } = require('../../ai');
const { buildVisualizationPrompt } = require('./prompt');

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
  if (!data.mermaid || typeof data.mermaid !== 'string') return 'Missing mermaid';
  if (data.mermaid.length < 10) return 'Mermaid too short';
  if (data.mermaid.length > 6000) return 'Mermaid too long';
  return null;
}

async function generate({ topic, kind }) {
  if (!topic || typeof topic !== 'string' || topic.trim().length < 2) {
    return { ok: false, code: 'INVALID_TOPIC' };
  }

  const systemPrompt = buildVisualizationPrompt({
    topic: topic.trim(),
    kind: kind || null,
  });

  let aiResult;
  try {
    aiResult = await chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Generate the diagram now. Return only JSON.' },
      ],
      temperature: 0.4,
      maxTokens: 1600,
    });
  } catch (err) {
    logger.error('[visualization] AI failed:', err.message);
    return { ok: false, code: 'AI_FAILED' };
  }

  let parsed;
  try { parsed = parseJSON(aiResult.text); }
  catch (_) {
    logger.warn('[visualization] JSON parse failed');
    return { ok: false, code: 'INVALID_AI_OUTPUT' };
  }

  const err = validate(parsed);
  if (err) {
    logger.warn('[visualization] validation failed:', err);
    return { ok: false, code: 'INVALID_AI_OUTPUT', detail: err };
  }

  return {
    ok: true,
    visualization: {
      title: parsed.title || topic,
      kind: parsed.kind || 'flowchart',
      mermaid: parsed.mermaid,
      explanation: parsed.explanation || '',
    },
  };
}

module.exports = { generate };