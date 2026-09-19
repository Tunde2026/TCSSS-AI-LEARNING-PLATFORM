// ============================================================
// tools/websearch/index.js
// ------------------------------------------------------------
// Registers the web_search tool with the tools registry.
// ============================================================

const service = require('./service');
const { register } = require('../registry');

register({
  name: 'web_search',
  description: 'Search the web for current information. Use when the query needs up-to-date facts.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string' },
      count: { type: 'integer', minimum: 1, maximum: 10, default: 5 },
    },
    required: ['query'],
  },
  async execute(input) {
    return service.search(input.query, { count: input.count });
  },
});

module.exports = { service };