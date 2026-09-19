const router  = require('./routes');
const service = require('./service');
const { register } = require('../registry');

register({
  name: 'flashcards',
  description: 'Generate flashcards on a topic for spaced-repetition study.',
  inputSchema: {
    type: 'object',
    properties: {
      topic:   { type: 'string' },
      count:   { type: 'integer', minimum: 1, maximum: 30, default: 10 },
      subject: { type: 'string' },
    },
    required: ['topic'],
  },
  async execute(input, ctx) {
    return service.generate({ userId: ctx.userId, ...input });
  },
});

module.exports = { router, service };