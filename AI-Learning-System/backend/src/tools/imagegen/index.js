const router  = require('./routes');
const service = require('./service');
const { register } = require('../registry');

register({
  name: 'image_generate',
  description: 'Generate an image from a text description. Use when the student asks to draw, illustrate, or create a picture.',
  inputSchema: {
    type: 'object',
    properties: {
      prompt: { type: 'string' },
      model:  { type: 'string', enum: ['flux','turbo','gptimage'], default: 'flux' },
      width:  { type: 'integer', minimum: 256, maximum: 1024, default: 1024 },
      height: { type: 'integer', minimum: 256, maximum: 1024, default: 1024 },
    },
    required: ['prompt'],
  },
  async execute(input) {
    return service.generate(input);
  },
});

module.exports = { router, service };