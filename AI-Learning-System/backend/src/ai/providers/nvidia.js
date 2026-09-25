module.exports = {
  id: 'nvidia',
  baseUrl: 'https://integrate.api.nvidia.com/v1',
  model: 'meta/llama-4-behemoth',
  timeoutMs: 25000,
  keys: [process.env.NVIDIA_KEY_1].filter(Boolean),
};
