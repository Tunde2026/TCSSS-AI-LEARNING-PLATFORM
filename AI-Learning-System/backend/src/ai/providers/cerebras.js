module.exports = {
  id: 'cerebras',
  baseUrl: 'https://api.cerebras.ai/v1',
  model: 'llama-3.3-70b',
  timeoutMs: 15000,
  keys: [process.env.CEREBRAS_KEY_1].filter(Boolean),
};