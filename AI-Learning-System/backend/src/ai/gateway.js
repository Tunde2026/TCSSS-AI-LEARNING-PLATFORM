// ============================================================
// gateway.js
// ------------------------------------------------------------
// Sequential fallback engine across providers and their keys.
//
// Architecture (project rule 9 — LLM decides, application executes):
//   - The gateway is the ONE place in the app that talks to AI providers.
//   - Tools, agents, and routes call gateway.chat(...).
//   - Provider configs live in ./providers/*.js.
//
// Fallback order:
//   provider[0].key[0] → provider[0].key[1] → provider[1].key[0] → ... → ollama
//
// Error handling:
//   429  → cool down this key, try next
//   401/403 → disable this key permanently, try next
//   5xx/408/timeout → cool down this key, try next
//   400/404/422 → STOP, our request is malformed — do not burn quota
//   200 with empty content → treat as server error, try next
// ============================================================

const crypto = require('crypto');
const logger = require('../core/logger');
const { systemPrompt } = require('./prompts');

const providers = [
  require('./providers/groq'),
  require('./providers/cerebras'),
  require('./providers/google'),
  require('./providers/nvidia'),
  require('./providers/openrouter'),
  require('./providers/ollama'),   // always last
];

// ---- Per-key state (in-memory for now; move to Redis when scaling) ----
const FAIL_THRESHOLD = 3;
const COOLDOWN_MS    = 60_000;

const keyState = new Map(); // hashed key → { failures, cooldownUntil, disabled, provider }

function hash(key) {
  return crypto.createHash('sha256').update(key).digest('hex').slice(0, 16);
}

function getState(key, providerId) {
  const h = hash(key);
  if (!keyState.has(h)) {
    keyState.set(h, {
      failures: 0,
      cooldownUntil: 0,
      disabled: false,
      provider: providerId,
    });
  }
  return keyState.get(h);
}

function recordSuccess(key, providerId) {
  const s = getState(key, providerId);
  s.failures = 0;
  s.cooldownUntil = 0;
}

function recordFailure(key, providerId, { disable = false } = {}) {
  const s = getState(key, providerId);
  if (disable) {
    s.disabled = true;
    logger.warn(`[gateway] disabled key for ${providerId} (auth failure)`);
    return;
  }
  s.failures += 1;
  if (s.failures >= FAIL_THRESHOLD) {
    s.cooldownUntil = Date.now() + COOLDOWN_MS;
    logger.warn(`[gateway] cooling down key for ${providerId} after ${s.failures} failures`);
  }
}

function classify(status) {
  if (status === 429)                          return 'rate_limited';
  if (status === 401 || status === 403)        return 'bad_key';
  if ([500, 502, 503, 504, 408].includes(status)) return 'server_error';
  if ([400, 404, 422].includes(status))        return 'fatal';
  return 'unknown';
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Build an ordered attempt list: provider order, then keys within provider.
function buildChain() {
  const chain = [];
  const now = Date.now();
  for (const p of providers) {
    for (const key of p.keys) {
      const s = getState(key, p.id);
      if (s.disabled) continue;
      if (s.cooldownUntil > now) continue;
      chain.push({ provider: p, key });
    }
  }
  return chain;
}

// ---- Public API ----
async function chat({ messages, temperature = 0.7, maxTokens = 1024 }) {
  if (!Array.isArray(messages) || messages.length === 0) {
    const err = new Error('messages must be a non-empty array');
    err.status = 400;
    throw err;
  }

  // Prepend the system prompt unless the caller already supplied one.
  const hasSystem = messages[0] && messages[0].role === 'system';
  const fullMessages = hasSystem
    ? messages
    : [{ role: 'system', content: systemPrompt }, ...messages];

  const chain = buildChain();
  const attempts = [];

  if (chain.length === 0) {
    const err = new Error('NO_PROVIDERS_AVAILABLE');
    err.attempts = attempts;
    throw err;
  }

  for (const { provider, key } of chain) {
    const label = `${provider.id}:${hash(key)}`;
    try {
      logger.debug(`[gateway] trying ${label}`);

      const res = await fetchWithTimeout(
        `${provider.baseUrl}/chat/completions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`,
          },
          body: JSON.stringify({
            model: provider.model,
            messages: fullMessages,
            temperature,
            max_tokens: maxTokens,
            stream: false,
          }),
        },
        provider.timeoutMs
      );

      if (res.ok) {
        const data = await res.json();
        const text = data?.choices?.[0]?.message?.content;
        if (!text) {
          // Treat silent empty responses as failure
          throw new Error('EMPTY_RESPONSE');
        }

        recordSuccess(key, provider.id);
        attempts.push({ provider: provider.id, result: 'ok' });
        logger.info(`[gateway] answered by ${provider.id}`);
        return {
          text,
          provider: provider.id,
          model: provider.model,
          attempts,
        };
      }

      // Non-OK response
      const kind = classify(res.status);
      attempts.push({ provider: provider.id, status: res.status, kind });

      if (kind === 'fatal') {
        // Our request is wrong — retrying elsewhere wastes quota.
        const err = new Error('REQUEST_REJECTED');
        err.status = res.status;
        err.attempts = attempts;
        throw err;
      }

      if (kind === 'bad_key') {
        recordFailure(key, provider.id, { disable: true });
      } else {
        recordFailure(key, provider.id);
      }
      // continue to next key/provider

    } catch (err) {
      // Fatal — rethrow immediately
      if (err.message === 'REQUEST_REJECTED') throw err;

      const isAbort = err.name === 'AbortError';
      const kind = isAbort ? 'timeout' : 'network_error';
      attempts.push({ provider: provider.id, kind });
      logger.warn(`[gateway] ${label} failed: ${kind}`);

      recordFailure(key, provider.id);
      continue;
    }
  }

  const err = new Error('ALL_PROVIDERS_FAILED');
  err.attempts = attempts;
  throw err;
}

// Debug view — NEVER returns the actual keys.
function _debugState() {
  const byProvider = {};
  for (const [h, s] of keyState.entries()) {
    const p = s.provider;
    if (!byProvider[p]) byProvider[p] = { healthy: 0, cooling: 0, disabled: 0 };
    if (s.disabled) byProvider[p].disabled += 1;
    else if (s.cooldownUntil > Date.now()) byProvider[p].cooling += 1;
    else byProvider[p].healthy += 1;
  }
  return {
    providers: providers.map(p => ({
      id: p.id,
      configuredKeys: p.keys.length,
      model: p.model,
    })),
    keyHealth: byProvider,
  };
}

module.exports = { chat, _debugState };