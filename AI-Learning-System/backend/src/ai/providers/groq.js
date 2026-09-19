// Groq provider config.
// VERIFY BASE URL AGAINST PROVIDER DOCS BEFORE DEPLOY.

module.exports = {
  id: 'groq',
  baseUrl: 'https://api.groq.com/openai/v1',
  model: 'llama-3.3-70b-versatile',
  timeoutMs: 15000,
  keys: [
    process.env.GROQ_KEY_1,
    process.env.GROQ_KEY_2,
  ].filter(Boolean),
};