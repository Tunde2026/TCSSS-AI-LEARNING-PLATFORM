// ============================================================
// ai/keyStore.js
// ============================================================

const db     = require('../db');
const logger = require('../core/logger');

const ENV_KEY_MAP = {
  groq:         ['GROQ_KEY_1', 'GROQ_KEY_2'],
  cerebras:     ['CEREBRAS_KEY_1'],
  google:       ['GOOGLE_KEY_1'],
  nvidia:       ['NVIDIA_KEY_1'],
  openrouter:   ['OPENROUTER_KEY_1'],
};

const providers = [
  require('./providers/groq'),
  require('./providers/cerebras'),
  require('./providers/google'),
  require('./providers/nvidia'),
  require('./providers/openrouter'),
];

let lastLoaded     = 0;
let tavilyKeys     = [];
let pexelsKeys     = [];
let pollinationsKey = null;

function envKeysFor(providerId) {
  return (ENV_KEY_MAP[providerId] || [])
    .map(function (k) { return process.env[k]; })
    .filter(Boolean);
}

async function loadAndApply() {
  try {
    const rows = await db.providerKeys.listEnabled();

    const byProvider = {};
    for (const r of rows) {
      if (!byProvider[r.provider]) byProvider[r.provider] = [];
      byProvider[r.provider].push({ id: r.id, value: r.key_value });
    }

    for (const p of providers) {
      const dbKeys  = (byProvider[p.id] || []).map(k => k.value);
      const envKeys = envKeysFor(p.id);
      p.keys = [...dbKeys, ...envKeys];
    }

    tavilyKeys = (byProvider.tavily || []).map(function (k) { return { id: k.id, value: k.value }; });
    if (tavilyKeys.length === 0 && process.env.TAVILY_API_KEY) {
      tavilyKeys = [{ id: null, value: process.env.TAVILY_API_KEY }];
    }

    pexelsKeys = (byProvider.pexels || []).map(function (k) { return { id: k.id, value: k.value }; });
    if (pexelsKeys.length === 0 && process.env.PEXELS_API_KEY) {
      pexelsKeys = [{ id: null, value: process.env.PEXELS_API_KEY }];
    }

    const pollinationsRow = (byProvider.pollinations || [])[0];
    pollinationsKey = (pollinationsRow && pollinationsRow.value) || process.env.POLLINATIONS_API_KEY || null;

    lastLoaded = Date.now();
    logger.debug('[keyStore] applied keys (tavily: ' + tavilyKeys.length +
                 ', pexels: ' + pexelsKeys.length +
                 ', pollinations: ' + (pollinationsKey ? 1 : 0) + ')');
  } catch (err) {
    logger.warn('[keyStore] load failed: ' + err.message);
  }
}

function getTavilyKeys()      { return tavilyKeys.slice(); }
function getPexelsKeys()      { return pexelsKeys.slice(); }
function getPollinationsKey() { return pollinationsKey; }
function isStale()            { return Date.now() - lastLoaded > 60000; }

module.exports = {
  loadAndApply,
  getTavilyKeys,
  getPexelsKeys,
  getPollinationsKey,
  isStale,
};