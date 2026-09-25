// ============================================================
// tools/sketch/index.js
// ------------------------------------------------------------
// Public interface for the Sketch tool.
// ============================================================

const router  = require('./routes');
const service = require('./service');
const { register } = require('../registry');

register({
  name: 'sketch',
  description:
    'Sketch — formula and scientific notation studio. ' +
    'Write chemical formulas (H₂SO₄), physics equations, and math expressions ' +
    'with proper fractions, superscripts, and roots. Can also solve simple math.',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['generate', 'solve', 'list'],
        default: 'generate',
      },
      query:      { type: 'string', description: 'What to build a formula for (generate action)' },
      expression: { type: 'string', description: 'Math expression to solve (solve action)' },
    },
  },
  async execute(input, ctx) {
    if (input && input.action === 'list')  return service.list({ userId: ctx.userId });
    if (input && input.action === 'solve') return service.solveExpression({ expression: input.expression });
    return service.generateFormula({ query: input.query });
  },
});

module.exports = { router, service };