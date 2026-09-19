const router  = require('./routes');
const service = require('./service');
const { register } = require('../registry');

register({
  name: 'notes',
  description: 'Save and organize personal study notes.',
  inputSchema: {
    type: 'object',
    properties: {
      title:   { type: 'string' },
      content: { type: 'string' },
      subject: { type: 'string' },
    },
    required: ['content'],
  },
  async execute(input, ctx) {
    return service.create(ctx.userId, input);
  },
});

module.exports = { router, service };