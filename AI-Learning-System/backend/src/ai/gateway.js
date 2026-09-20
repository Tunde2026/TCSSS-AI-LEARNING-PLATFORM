// ============================================================
// ai/gateway.js
// ------------------------------------------------------------
// Sequential fallback engine across providers and their keys.
//
// Fallback order:
//   provider[0].key[0] -> provider[0].key[1] -> provider[1].key[0] -> ... -> ollama
//
// Error handling:
//   429            -> cool down key, try next
//   401/403        -> disable key, try next
//   404            -> try next provider (usually means wrong model/URL for THIS provider)
//   5xx/408        -> cool down key, try next
//   400/422        -> STOP (our request is malformed)
//   network error  -> try next
//   200 empty body -> treat as server error, try next
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
  require('./providers/ollama'),
];

const FAIL_THRESHOLD = 3;
const COOLDOWN_MS    = 60_000;

const keyState = new Map();

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

function recordFailure(key, providerId, opts) {
  opts = opts || {};
  const s = getState(key, providerId);
  if (opts.disable) {
    s.disabled = true;
    logger.warn('[gateway] disabled key for ' + providerId + ' (auth failure)');
    return;
  }
  s.failures += 1;
  if (s.failures >= FAIL_THRESHOLD) {
    s.cooldownUntil = Date.now() + COOLDOWN_MS;
    logger.warn('[gateway] cooling down key for ' + providerId + ' after ' + s.failures + ' failures');
  }
}

function classify(status) {
  if (status === 429) return 'rate_limited';
  if (status === 401 || status === 403) return 'bad_key';
  if (status === 404) return 'not_found';
  if (status === 408) return 'server_error';
  if (status >= 500 && status <= 599) return 'server_error';
  if (status === 400 || status === 422) return 'fatal';
  return 'unknown';
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(function () { controller.abort(); }, timeoutMs);
  try {
    return await fetch(url, Object.assign({}, options, { signal: controller.signal }));
  } finally {
    clearTimeout(timer);
  }
}

function buildChain() {
  const chain = [];
  const now = Date.now();
  for (let i = 0; i < providers.length; i++) {
    const p = providers[i];
    for (let j = 0; j < p.keys.length; j++) {
      const key = p.keys[j];
      const s = getState(key, p.id);
      if (s.disabled) continue;
      if (s.cooldownUntil > now) continue;
      chain.push({ provider: p, key: key });
    }
  }
  return chain;
}

async function readErrorBody(res) {
  try {
    const text = await res.text();
    if (!text) return '';
    if (text.length > 400) return text.slice(0, 400) + '...';
    return text;
  } catch (_) {
    return '';
  }
}

async function chat(input) {
  const messages = input.messages;
  const temperature = input.temperature != null ? input.temperature : 0.7;
  const maxTokens = input.maxTokens != null ? input.maxTokens : 1024;

  if (!Array.isArray(messages) || messages.length === 0) {
    const err = new Error('messages must be a non-empty array');
    err.status = 400;
    throw err;
  }

  const hasSystem = messages[0] && messages[0].role === 'system';
  const fullMessages = hasSystem
    ? messages
    : [{ role: 'system', content: systemPrompt }].concat(messages);

  const chain = buildChain();
  const attempts = [];

  if (chain.length === 0) {
    const err = new Error('NO_PROVIDERS_AVAILABLE');
    err.attempts = attempts;
    throw err;
  }

  for (let i = 0; i < chain.length; i++) {
    const entry = chain[i];
    const provider = entry.provider;
    const key = entry.key;
    const label = provider.id + ':' + hash(key);

    try {
      logger.debug('[gateway] trying ' + label + ' (model: ' + provider.model + ')');

      const res = await fetchWithTimeout(
        provider.baseUrl + '/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + key,
          },
          body: JSON.stringify({
            model: provider.model,
            messages: fullMessages,
            temperature: temperature,
            max_tokens: maxTokens,
            stream: false,
          }),
        },
        provider.timeoutMs
      );

      if (res.ok) {
        const data = await res.json();
        const text = data && data.choices && data.choices[0]
          && data.choices[0].message
          && data.choices[0].message.content;
        if (!text) {
          throw new Error('EMPTY_RESPONSE');
        }

        recordSuccess(key, provider.id);
        attempts.push({ provider: provider.id, result: 'ok' });
        logger.info('[gateway] answered by ' + provider.id);
        return {
          text: text,
          provider: provider.id,
          model: provider.model,
          attempts: attempts,
        };
      }

      const kind = classify(res.status);
      const errBody = await readErrorBody(res);
      attempts.push({ provider: provider.id, status: res.status, kind: kind });

      logger.warn(
        '[gateway] ' + provider.id + ' returned ' + res.status +
        ' (' + kind + ')' + (errBody ? ' :: ' + errBody : '')
      );

      if (kind === 'fatal') {
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
      // any other kind -> continue to next key/provider

    } catch (err) {
      if (err.message === 'REQUEST_REJECTED') throw err;

      const isAbort = err.name === 'AbortError';
      const kind = isAbort ? 'timeout' : 'network_error';
      attempts.push({ provider: provider.id, kind: kind });
      logger.warn('[gateway] ' + label + ' failed: ' + kind);

      recordFailure(key, provider.id);
      continue;
    }
  }

  const err = new Error('ALL_PROVIDERS_FAILED');
  err.attempts = attempts;
  throw err;
}

function _debugState() {
  const byProvider = {};
  for (const entry of keyState.entries()) {
    const s = entry[1];
    const p = s.provider;
    if (!byProvider[p]) byProvider[p] = { healthy: 0, cooling: 0, disabled: 0 };
    if (s.disabled) byProvider[p].disabled += 1;
    else if (s.cooldownUntil > Date.now()) byProvider[p].cooling += 1;
    else byProvider[p].healthy += 1;
  }
  return {
    providers: providers.map(function (p) {
      return {
        id: p.id,
        configuredKeys: p.keys.length,
        model: p.model,
        baseUrl: p.baseUrl,
      };
    }),
    keyHealth: byProvider,
  };
}

module.exports = { chat: chat, _debugState: _debugState };
