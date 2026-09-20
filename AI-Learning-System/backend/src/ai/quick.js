// ============================================================
// ai/quick.js
// ------------------------------------------------------------
// Ephemeral ask-AI endpoint. No conversation saved, no attachments.
// Context-aware: the caller passes the current page/section so
// the AI knows what the student is doing.
// ============================================================

const { chat } = require('./gateway');
const logger = require('../core/logger');

const QUICK_FORMAT_RULES = `

# FORMATTING RULES

Your answer is rendered as Markdown with LaTeX math. Use them properly:

- Inline math: $x^2 + 5x = 0$
- Display math on its own line: $$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$
- Fractions: $\\frac{a}{b}$; roots: $\\sqrt{x}$; sums: $\\sum_{i=1}^{n}$;
  integrals: $\\int_0^1$; Greek: $\\alpha$, $\\pi$, $\\theta$
- Single variables get dollar signs: $x$, $y$, $n$ — not bare letters
- Units go outside math: $5$ m/s, not $5 m/s$
- Code uses fenced blocks with language tags
- Keep answers SHORT — this is a quick panel, not a full lesson
- No tables. No horizontal rules.
- No "Great question!" filler.`;

async function quickAsk({ user, messages, context }) {
  if (!Array.isArray(messages) || messages.length === 0) {
    const err = new Error('messages required');
    err.status = 400;
    throw err;
  }

  var contextBlock = '';
  if (context && typeof context === 'object') {
    var bits = [];
    if (context.section) bits.push('Section: ' + context.section);
    if (context.topic)   bits.push('Topic: ' + context.topic);
    if (context.detail)  bits.push('Detail: ' + context.detail);
    if (bits.length) {
      contextBlock =
        'The student is currently using the "' + (context.section || 'app') +
        '" section of the platform. ' + bits.join('. ') + '. ' +
        'Answer their quick question below, briefly and helpfully. ' +
        'Do not save this conversation or refer to it later.' +
        QUICK_FORMAT_RULES;
    } else {
      contextBlock = 'You are a quick help assistant. Answer briefly.' + QUICK_FORMAT_RULES;
    }
  } else {
    contextBlock = 'You are a quick help assistant. Answer briefly.' + QUICK_FORMAT_RULES;
  }

  var gatewayMessages = messages;
  if (contextBlock) {
    gatewayMessages = [{ role: 'system', content: contextBlock }].concat(messages);
  }

  try {
    const result = await chat({ messages: gatewayMessages, maxTokens: 700 });
    return { ok: true, text: result.text, provider: result.provider };
  } catch (err) {
    logger.warn('[ai/quick] ' + err.message);
    return { ok: false, code: err.message };
  }
}

module.exports = { quickAsk };