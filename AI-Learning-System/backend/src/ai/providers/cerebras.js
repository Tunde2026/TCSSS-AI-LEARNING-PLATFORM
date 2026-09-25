module.exports = {
  id: 'cerebras',
  baseUrl: 'https://api.cerebras.ai/v1',
  model: 'qwen-3-235b',
  timeoutMs: 15000,
  keys: [process.env.CEREBRAS_KEY_1].filter(Boolean),
};
