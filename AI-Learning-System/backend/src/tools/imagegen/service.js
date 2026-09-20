// ============================================================
// tools/imagegen/service.js
// ------------------------------------------------------------
// AI image generation via Pollinations.
// Downloads the generated image and stores it locally.
// ============================================================

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const logger = require('../../core/logger');

// backend/src/tools/imagegen -> 4 levels up = project root
const PROJECT_ROOT = path.join(__dirname, '..', '..', '..', '..');
const OUT_DIR      = path.join(PROJECT_ROOT, 'uploads', 'generated');

function getKey() {
  try {
    const keyStore = require('../../ai').keyStore;
    if (keyStore && keyStore.getPollinationsKey) {
      const k = keyStore.getPollinationsKey();
      if (k) return k;
    }
  } catch (_) {}
  return process.env.POLLINATIONS_API_KEY || null;
}

function isEnabled() {
  return true; // Pollinations works with or without a key
}

function ensureDir() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

function slugify(s) {
  return String(s || 'image')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'image';
}

async function generate(input) {
  input = input || {};
  const prompt = input.prompt;
  const model  = input.model || 'flux';
  const width  = input.width  || 1024;
  const height = input.height || 1024;
  const seed   = input.seed;

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 3) {
    return { ok: false, code: 'INVALID_PROMPT' };
  }

  const cleanPrompt = prompt.trim().slice(0, 500);
  const w = Math.max(256, Math.min(1024, Number(width) || 1024));
  const h = Math.max(256, Math.min(1024, Number(height) || 1024));
  const useSeed = seed != null ? Number(seed) : Math.floor(Math.random() * 1e9);

  const url = 'https://gen.pollinations.ai/image/' + encodeURIComponent(cleanPrompt) +
    '?model=' + encodeURIComponent(model) +
    '&width=' + w +
    '&height=' + h +
    '&seed=' + useSeed +
    '&nologo=true' +
    '&private=true';

  const headers = {};
  const key = getKey();
  if (key) headers['Authorization'] = 'Bearer ' + key;

  let res;
  try {
    res = await fetch(url, { headers: headers });
  } catch (err) {
    logger.warn('[imagegen] network error: ' + err.message);
    return { ok: false, code: 'NETWORK_ERROR' };
  }

  if (!res.ok) {
    const body = await res.text().catch(function () { return ''; });
    logger.warn('[imagegen] Pollinations ' + res.status + ': ' + body.slice(0, 200));
    return { ok: false, code: 'HTTP_' + res.status, detail: body.slice(0, 200) };
  }

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 500) {
    return { ok: false, code: 'EMPTY_IMAGE' };
  }

  ensureDir();
  const filename = Date.now() + '-' + crypto.randomBytes(4).toString('hex') +
                   '-' + slugify(cleanPrompt) + '.png';
  const fullPath = path.join(OUT_DIR, filename);
  fs.writeFileSync(fullPath, buf);

  const publicUrl = '/uploads/generated/' + filename;
  logger.info('[imagegen] saved ' + filename + ' (' + Math.round(buf.length / 1024) + ' KB)');

  return {
    ok: true,
    image: {
      url: publicUrl,
      source: 'pollinations',
      prompt: cleanPrompt,
      model: model,
      width: w,
      height: h,
      seed: useSeed,
    },
  };
}

module.exports = { generate: generate, isEnabled: isEnabled, OUT_DIR: OUT_DIR };
