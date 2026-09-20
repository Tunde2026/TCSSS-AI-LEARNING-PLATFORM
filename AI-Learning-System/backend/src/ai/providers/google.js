module.exports = {
  id: 'google',
  baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
  model: 'gemini-2.5-flash',
  timeoutMs: 25000,
  keys: [process.env.GOOGLE_KEY_1].filter(Boolean),
};
