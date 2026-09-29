// ============================================================
// ai/providers/ollama.js
// ------------------------------------------------------------
// Local Ollama fallback. Runs last in the chain when every
// cloud provider has failed.
//
// We expose MULTIPLE local models as separate "providers" in
// the chain so that if the fast small model fails, the gateway
// automatically retries with a larger or more specialised one.
//
// Priority order:
//   1. qwen2.5:3b       — fastest, good enough for most replies
//   2. llama3.1:8b      — higher quality general purpose
//   3. deepseek-r1:7b   — strong at math & science reasoning
//   4. qwen2.5:7b       — solid all-rounder
//
// Only models actually installed on the machine get used; the
// gateway picks them up automatically. Edit OLLAMA_MODEL in
// .env to change the primary fallback model.
// ============================================================

const config = require('../../core').config;

const primary = process.env.OLLAMA_MODEL || 'qwen2.5:3b';

// Ordered fallback list. Primary first, then sensible backups.
const allModels = [
  primary,
  'llama3.1:8b',
  'deepseek-r1:7b',
  'qwen2.5:7b',
  'qwen2.5:3b',
];

// Deduplicate, keep order
const seen = new Set();
const models = allModels.filter(function (m) {
  if (seen.has(m)) return false;
  seen.add(m);
  return true;
});

module.exports = {
  id: 'ollama',
  supportsTools: true,  // model-dependent
  baseUrl: config.ollama.url || 'http://localhost:11434/v1',
  model: primary,
  timeoutMs: 120000,
  keys: ['ollama'],
  extraHeaders: {},
  // Used by the gateway to expand into multiple chain entries
  fallbackModels: models,
};
