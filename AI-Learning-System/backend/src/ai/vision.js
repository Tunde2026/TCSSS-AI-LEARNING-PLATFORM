// ============================================================
// ai/vision.js
// ------------------------------------------------------------
// Image understanding pipeline.
//
// Chain:
//   1. OpenAI vision (gpt-4o-mini) — best quality, needs credits
//   2. Ollama vision (llava:7b)   — free, local, no API cost
//
// If both fail, returns a clear error instead of hallucinating.
// ============================================================

const logger = require('../core/logger');

const OPENAI_MODEL = process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini';
const OLLAMA_URL   = (process.env.OLLAMA_URL || 'http://localhost:11434/v1');
const OLLAMA_MODEL = process.env.OLLAMA_VISION_MODEL || 'llava:7b';
const TIMEOUT_MS   = 60000;

function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return fetch(url, Object.assign({}, options, { signal: controller.signal }));
  } finally {
    clearTimeout(timer);
  }
}

/* ---------- OpenAI vision ---------- */
async function tryOpenAI(userText, images) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { ok: false, code: 'NO_OPENAI_KEY' };

  const content = [{ type: 'text', text: userText }];
  for (const img of images) {
    content.push({
      type: 'image_url',
      image_url: { url: 'data:' + img.mimetype + ';base64,' + img.base64 },
    });
  }

  try {
    const res = await fetchWithTimeout(
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + key,
        },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          messages: [{ role: 'user', content }],
          max_tokens: 2000,
          temperature: 0.5,
        }),
      },
      TIMEOUT_MS
    );

    if (!res.ok) {
      const body = await res.text().catch(function () { return ''; });
      logger.warn('[vision:openai] HTTP ' + res.status + ': ' + body.slice(0, 300));
      return { ok: false, code: 'OPENAI_' + res.status, detail: body.slice(0, 200) };
    }

    const data = await res.json();
    const text = data && data.choices && data.choices[0]
              && data.choices[0].message
              && data.choices[0].message.content;

    if (!text) return { ok: false, code: 'EMPTY_RESPONSE' };
    return { ok: true, text, provider: 'openai-vision', model: OPENAI_MODEL };
  } catch (err) {
    if (err.name === 'AbortError') return { ok: false, code: 'TIMEOUT' };
    logger.warn('[vision:openai] threw: ' + err.message);
    return { ok: false, code: 'NETWORK_ERROR' };
  }
}

/* ---------- Ollama vision (llava) ---------- */
async function tryOllama(userText, images) {
  // Ollama's OpenAI-compatible endpoint accepts images as base64 data URLs
  const content = [{ type: 'text', text: userText }];
  for (const img of images) {
    content.push({
      type: 'image_url',
      image_url: { url: 'data:' + img.mimetype + ';base64,' + img.base64 },
    });
  }

  try {
    const res = await fetchWithTimeout(
      OLLAMA_URL + '/chat/completions',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          messages: [{ role: 'user', content }],
          max_tokens: 2000,
          temperature: 0.5,
        }),
      },
      TIMEOUT_MS
    );

    if (!res.ok) {
      const body = await res.text().catch(function () { return ''; });
      logger.warn('[vision:ollama] HTTP ' + res.status + ': ' + body.slice(0, 200));
      return { ok: false, code: 'OLLAMA_' + res.status };
    }

    const data = await res.json();
    const text = data && data.choices && data.choices[0]
              && data.choices[0].message
              && data.choices[0].message.content;

    if (!text) return { ok: false, code: 'EMPTY_RESPONSE' };
    return { ok: true, text, provider: 'ollama-vision', model: OLLAMA_MODEL };
  } catch (err) {
    if (err.name === 'AbortError') return { ok: false, code: 'TIMEOUT' };
    logger.warn('[vision:ollama] threw: ' + err.message);
    return { ok: false, code: 'OLLAMA_UNREACHABLE' };
  }
}

/* ---------- Public API ---------- */
async function describeImages({ userText, images }) {
  if (!Array.isArray(images) || !images.length) {
    return { ok: false, code: 'NO_IMAGES' };
  }

  const prompt = userText && userText.trim()
    ? userText
    : 'Look at this image carefully. Describe what it shows in 2-3 sentences, then extract any text you can read from it.';

  // Try OpenAI first
  const openaiResult = await tryOpenAI(prompt, images);
  if (openaiResult.ok) {
    logger.info('[vision] answered by OpenAI (' + openaiResult.model + ')');
    return openaiResult;
  }
  logger.warn('[vision] OpenAI failed (' + openaiResult.code + ') — trying Ollama');

  // Fall back to Ollama
  const ollamaResult = await tryOllama(prompt, images);
  if (ollamaResult.ok) {
    logger.info('[vision] answered by Ollama (' + ollamaResult.model + ')');
    return ollamaResult;
  }

  // Both failed
  logger.warn('[vision] both providers failed');
  return {
    ok: false,
    code: 'ALL_VISION_PROVIDERS_FAILED',
    openai: openaiResult.code,
    ollama: ollamaResult.code,
  };
}

/* ---------- Extraction-only helper (for the extraction page) ---------- */
async function extractText({ images }) {
  const prompt = 'Read all text visible in this image. Return ONLY the extracted text with no commentary. If the image contains a math problem, formula, or diagram, describe it briefly after the extracted text.';

  const openaiResult = await tryOpenAI(prompt, images);
  if (openaiResult.ok) return openaiResult;

  const ollamaResult = await tryOllama(prompt, images);
  if (ollamaResult.ok) return ollamaResult;

  return {
    ok: false,
    code: 'ALL_VISION_PROVIDERS_FAILED',
    openai: openaiResult.code,
    ollama: ollamaResult.code,
  };
}

module.exports = { describeImages, extractText, OPENAI_MODEL, OLLAMA_MODEL };
