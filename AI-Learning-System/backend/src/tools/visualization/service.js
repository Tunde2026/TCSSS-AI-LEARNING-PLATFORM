const logger = require('../../core/logger');
const { chat } = require('../../ai/gateway');
const { buildVisualizationPrompt } = require('./prompt');

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
  if (!data.mermaid || typeof data.mermaid !== 'string') return 'Missing mermaid';
  if (data.mermaid.length < 10) return 'Mermaid too short';
  if (data.mermaid.length > 6000) return 'Mermaid too long';
  return null;
}

function cleanDescription(d) {
  if (d == null) return null;
  const s = String(d).trim();
  if (!s) return null;
  return s.slice(0, MAX_DESCRIPTION_LENGTH);
}

async function generate({ topic, kind, description = null }) {
  if (!topic || typeof topic !== 'string' || topic.trim().length < 2) {
    return { ok: false, code: 'INVALID_TOPIC' };
  }

  const cleanNote = cleanDescription(description);

  let systemPrompt = buildVisualizationPrompt({
    topic: topic.trim(),
    kind: kind || null,
  });

  // If the student added a note, use it to steer the diagram
  if (cleanNote) {
    systemPrompt +=
      '\n\n# STUDENT NOTE\n\n' +
      'The student added this note to guide the diagram. Use it to decide what to ' +
      'emphasise, simplify, or leave out:\n\n"' + cleanNote + '"\n\n' +
      'Do not add the note text into the diagram itself — just let it influence your choices.';
  }

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
      description: cleanNote,
    },
  };
}

module.exports = { generate };