// Quiz tool — public interface.
// Registers itself with the tools registry so the AI Router can find it.

const router  = require('./routes');
const service = require('./service');
const { register } = require('../registry');

register({
  name: 'quiz',
  description: 'Generate multiple-choice quiz questions on a given topic.',
  inputSchema: {
    type: 'object',
    properties: {
      topic:      { type: 'string', description: 'The academic topic' },
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