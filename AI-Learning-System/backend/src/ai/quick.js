// ============================================================
// ai/quick.js
// ------------------------------------------------------------
// Ephemeral ask-AI endpoint. No conversation saved, no attachments.
// Uses the SAME platform system prompt as Chat, plus a short
// context block telling the AI what section the student is in.
// ============================================================

const { chat } = require('./gateway');
const logger = require('../core/logger');

let SYSTEM_PROMPT;
try {
  SYSTEM_PROMPT = require('./prompts/system');
} catch (err) {
  SYSTEM_PROMPT = 'You are the AI tutor for TCSSS students. Be accurate, kind, and clear.';
  logger.warn('[ai/quick] could not load system prompt: ' + err.message);
}

const QUICK_CONTEXT_RULES = `

# QUICK PANEL CONTEXT

You are responding inside the floating "Ask AI" panel — a quick help
side-panel that appears on every page. This is NOT a full chat session:

- The student's message here is a quick question about what they are doing
- No conversation history is saved — do not refer to previous quick-panel answers
- Keep answers SHORT — 2 to 5 short paragraphs is usually enough
- Do NOT start with "Great question!" or similar filler
- Do NOT run through a full lesson unless the student explicitly asks
- Apply every rule from the main system instructions above (accuracy, math
  formatting, academic honesty, privacy, no invented sources, etc.)`;

async function quickAsk({ user, messages, context }) {
  if (!Array.isArray(messages) || messages.length === 0) {
    const err = new Error('messages required');
    err.status = 400;
    throw err;
  }

  // Build a short section-aware context string.
  var sectionBits = [];
  if (context && typeof context === 'object') {
    if (context.section) sectionBits.push('Section: ' + context.section);
    if (context.topic)   sectionBits.push('Topic: ' + context.topic);
    if (context.detail)  sectionBits.push('Detail: ' + context.detail);
  }
  var contextLine = sectionBits.length
    ? 'The student is currently in the ' + sectionBits.join(' · ') + '.'
    : 'The student is using the platform.';

  // Compose the full system prompt: platform rules + quick-panel rules + live context.
  var fullSystemPrompt =
    SYSTEM_PROMPT +
    QUICK_CONTEXT_RULES +
    '\n\n# CURRENT CONTEXT\n\n' + contextLine;

  var gatewayMessages = [{ role: 'system', content: fullSystemPrompt }].concat(messages);

  try {
    const result = await chat({ messages: gatewayMessages, maxTokens: 700 });
    return { ok: true, text: result.text, provider: result.provider };
  } catch (err) {
    logger.warn('[ai/quick] ' + err.message);
    return { ok: false, code: err.message };
  }
}

module.exports = { quickAsk };