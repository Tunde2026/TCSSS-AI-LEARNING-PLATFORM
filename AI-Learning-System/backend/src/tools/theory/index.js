// ============================================================
// tools/theory/index.js
// ------------------------------------------------------------
// Public interface for the Theory tool.
// Registers with the tools registry so the AI Router can find it.
// ============================================================

const router  = require('./routes');
const service = require('./service');
const { register } = require('../registry');

register({
  name: 'theory',
  description:
    'Generate fill-in-the-gap theory questions on a topic. ' +
    'Each question is a sentence with a ___ blank that the student fills in. ' +
    'Useful for recall practice and exam-style theory sections.',
  inputSchema: {
    type: 'object',
    properties: {
      topic:      { type: 'string', description: 'The academic topic' },
      count:      { type: 'integer', minimum: 1, maximum: 30, default: 5 },
      difficulty: { type: 'string', enum: ['easy','medium','hard'], default: 'medium' },
      subject:    { type: 'string' },
    },
    required: ['topic'],
  },
  async execute(input, ctx) {
    return service.generate({ userId: ctx.userId, ...input });
  },
});

module.exports = { router, service };