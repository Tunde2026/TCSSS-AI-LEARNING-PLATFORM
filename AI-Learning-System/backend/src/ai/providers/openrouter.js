module.exports = {
  id: 'openrouter',
  baseUrl: 'https://openrouter.ai/api/v1',
  model: 'google/gemma-3-12b-it:free',
  timeoutMs: 25000,
  keys: [process.env.OPENROUTER_KEY_1].filter(Boolean),
};
