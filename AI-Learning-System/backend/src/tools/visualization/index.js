const router  = require('./routes');
const service = require('./service');
const { register } = require('../registry');

register({
  name: 'visualization',
  description: 'Generate a diagram (Mermaid) explaining a topic or process.',
  inputSchema: {
    type: 'object',
    properties: {
      topic: { type: 'string' },
      kind:  { type: 'string', enum: ['flowchart','sequence','mindmap','class','timeline','state'] },
    },
    required: ['topic'],
  },
  async execute(input, ctx) {
    return service.generate(input);
  },
});

module.exports = { router, service };