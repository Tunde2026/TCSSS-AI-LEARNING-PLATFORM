const router  = require('./routes');
const service = require('./service');
const { register } = require('../registry');

register({
  name: 'notes',
  description: 'Save and organize personal study notes.',
   inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['create', 'list', 'ai_transform'],
        default: 'create',
      },
      title:  { type: 'string' },
      content:{ type: 'string' },
      subject:{ type: 'string' },
      noteId: { type: 'string', description: 'Note to transform (for ai_transform)' },
      transformAction: {
        type: 'string',
        enum: ['summarize','rephrase','fix_typos','simplify','expand','key_points','outline'],
        description: 'AI action to apply',
      },
    },
  },
    async execute(input, ctx) {
    if (input.action === 'list') return service.list(ctx.userId);
    if (input.action === 'ai_transform') {
      return service.aiTransform({
        userId: ctx.userId,
        noteId: input.noteId,
        action: input.transformAction,
      });
    }
    return service.create(ctx.userId, input);
  },
});

module.exports = { router, service };