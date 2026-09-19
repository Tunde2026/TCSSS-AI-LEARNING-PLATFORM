// ============================================================
// ai/keyStore.js
// ------------------------------------------------------------
// Loads provider API keys from the database and applies them
// to the provider config objects at runtime.
//
// Providers keep their static config; only the `keys` array
// is replaced. The gateway reads p.keys at call time, so no
// gateway changes are required.
//
// DB keys take priority. Any keys still in .env are appended
// as fallbacks, so nothing breaks during migration.
// ============================================================

const db     = require('../db');
const logger = require('../core/logger');

// Only mutate keys for these providers. Ollama does not use a key.
const ENV_KEY_MAP = {
  groq:       ['GROQ_KEY_1', 'GROQ_KEY_2'],
  cerebras:   ['CEREBRAS_KEY_1'],
  google:     ['GOOGLE_KEY_1'],
  nvidia:     ['NVIDIA_KEY_1'],
  openrouter: ['OPENROUTER_KEY_1'],
};

const providers = [
  require('./providers/groq'),
  require('./providers/cerebras'),
  require('./providers/google'),
  require('./providers/nvidia'),
  require('./providers/openrouter'),
];

let lastLoaded = 0;
let lastTavily = null;

function envKeysFor(providerId) {
  return (ENV_KEY_MAP[providerId] || [])
    .map(k => process.env[k])
    .filter(Boolean);
}

async function loadAndApply() {
  try {
    const rows = await db.providerKeys.listEnabled();

    const byProvider = {};
    for (const r of rows) {
      if (!byProvider[r.provider]) byProvider[r.provider] = [];
      byProvider[r.provider].push(r.key_value);
    }

    for (const p of providers) {
      const dbKeys  = byProvider[p.id] || [];
      const envKeys = envKeysFor(p.id);
      p.keys = [...dbKeys, ...envKeys];
    }

    // Tavily is a special case — it is used by the websearch tool.
    lastTavily = (byProvider.tavily && byProvider.tavily[0]) ||
                 process.env.TAVILY_API_KEY ||
                 null;

    lastLoaded = Date.now();
    logger.debug('[keyStore] applied provider keys');
  } catch (err) {
    logger.warn('[keyStore] load failed:', err.message);
  }
}

function getTavilyKey() {
  return lastTavily;
}

function isStale() {
  return Date.now() - lastLoaded > 60_000;
}

module.exports = { loadAndApply, getTavilyKey, isStale };