const router  = require('./routes');
const service = require('./service');
const { register } = require('../registry');

register({
  name: 'image_search',
  description: 'Find real photos from the internet. Use when the student asks for a real picture of something.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string' },
      count: { type: 'integer', minimum: 1, maximum: 30, default: 8 },
    },
    required: ['query'],
  },
  async execute(input) {
    return service.search(input.query, { count: input.count });
  },
});

module.exports = { router, service };