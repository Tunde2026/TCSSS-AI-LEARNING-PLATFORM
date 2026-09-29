module.exports = {
  id: 'groq',
  supportsTools: true,  // native OpenAI tool-calling
  baseUrl: 'https://api.groq.com/openai/v1',
  model: 'openai/gpt-oss-120b',
  timeoutMs: 15000,
  keys: [process.env.GROQ_KEY_1, process.env.GROQ_KEY_2].filter(Boolean),
};
