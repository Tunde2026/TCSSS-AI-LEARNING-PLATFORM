module.exports = {
  id: 'nvidia',
  baseUrl: 'https://integrate.api.nvidia.com/v1',
  model: 'meta/llama-3.1-70b-instruct',
  timeoutMs: 25000,
  keys: [process.env.NVIDIA_KEY_1].filter(Boolean),
};