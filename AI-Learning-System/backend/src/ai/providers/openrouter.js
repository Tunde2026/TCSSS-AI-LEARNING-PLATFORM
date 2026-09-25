module.exports = {
  id: 'openrouter',
  baseUrl: 'https://openrouter.ai/api/v1',
  model: 'openrouter/free',
  timeoutMs: 25000,
  keys: [process.env.OPENROUTER_KEY_1].filter(Boolean),
};
