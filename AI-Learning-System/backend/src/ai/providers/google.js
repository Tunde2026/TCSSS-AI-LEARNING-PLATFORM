module.exports = {
  id: 'google',
  baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
  model: 'gemma-3-27b-it',
  timeoutMs: 25000,
  keys: [process.env.GOOGLE_KEY_1].filter(Boolean),
};