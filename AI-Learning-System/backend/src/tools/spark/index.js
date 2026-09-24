// ============================================================
// tools/spark/index.js
// ------------------------------------------------------------
// Public interface for the Spark tool.
// Registers with the tools registry so the AI Router can find it.
// ============================================================

const router  = require('./routes');
const service = require('./service');
const { register } = require('../registry');

register({
  name: 'spark',
  description:
    'Spark — Discover Your Potential. Launches an adaptive assessment that ' +
    'explores interests, reasoning, problem-solving, and academic direction. ' +
    'Produces evidence-based alignment across Science, Arts, and Commerce.',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['start', 'history'],
        default: 'start',
        description: 'start a new assessment, or view past assessments',
      },
    },
  },
  async execute(input, ctx) {
    if (input && input.action === 'history') {
      return service.listHistory(ctx.userId);
    }
    return service.startAssessment(ctx.userId);
  },
});

module.exports = { router, service };