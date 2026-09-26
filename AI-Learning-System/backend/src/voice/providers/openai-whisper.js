// ============================================================
// voice/providers/openai-whisper.js
// ------------------------------------------------------------
// Cloud transcription via OpenAI Whisper API.
// Docs: https://platform.openai.com/docs/guides/speech-to-text
// ============================================================

const logger = require('../../core/logger');

const API = 'https://api.openai.com/v1/audio/transcriptions';

async function transcribe(buffer, mimeType) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('NO_KEY');

  const form = new FormData();
  form.append(
    'file',
    new Blob([buffer], { type: mimeType || 'audio/webm' }),
    'audio.webm'
  );
  form.append('model', 'whisper-1');
  form.append('language', 'en');

  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + key },
    body: form,
  });

  if (!res.ok) {
    const txt = await res.text().catch(function () { return ''; });
    logger.warn('[voice/openai] HTTP ' + res.status + ': ' + txt.slice(0, 200));
    throw new Error('HTTP_' + res.status);
  }

  const data = await res.json().catch(function () { return {}; });
  return data.text || '';
}

module.exports = { transcribe, name: 'openai' };