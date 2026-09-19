const router  = require('./routes');
const service = require('./service');
const { register } = require('../registry');

register({
  name: 'study_plan',
  description: 'Generate a multi-day study plan on any topic.',
  inputSchema: {
    type: 'object',
    properties: {
      topic:    { type: 'string' },
      days:     { type: 'integer', minimum: 3, maximum: 30, default: 7 },
      subject:  { type: 'string' },
      examDate: { type: 'string' },
    },
    required: ['topic'],
  },
  async execute(input, ctx) {
    return service.generate({ userId: ctx.userId, ...input });
  },
});

module.exports = { router, service };