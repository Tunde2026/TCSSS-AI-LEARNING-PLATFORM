const router  = require('./routes');
const service = require('./service');
const { register } = require('../registry');

register({
  name: 'practice',
  description: 'Generate open-ended practice questions with model answers.',
  inputSchema: {
    type: 'object',
    properties: {
      topic:      { type: 'string' },
      count:      { type: 'integer', minimum: 1, maximum: 20, default: 5 },
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