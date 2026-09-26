// ============================================================
// voice/providers/deepgram.js
// ------------------------------------------------------------
// Cloud transcription via Deepgram Nova-2.
// Docs: https://developers.deepgram.com/reference/speech-to-text
// ============================================================

const logger = require('../../core/logger');

const API = 'https://api.deepgram.com/v1/listen';

async function transcribe(buffer, mimeType) {
  const key = process.env.DEEPGRAM_API_KEY;
  if (!key) throw new Error('NO_KEY');

  const params = new URLSearchParams({
    model: 'nova-2',
    smart_format: 'true',
    punctuate: 'true',
    language: 'en',
  });

  const res = await fetch(API + '?' + params.toString(), {
    method: 'POST',
    headers: {
      'Authorization': 'Token ' + key,
      'Content-Type': mimeType || 'audio/webm',
    },
    body: buffer,
  });

  if (!res.ok) {
    const txt = await res.text().catch(function () { return ''; });
    logger.warn('[voice/deepgram] HTTP ' + res.status + ': ' + txt.slice(0, 200));
    throw new Error('HTTP_' + res.status);
  }

  const data = await res.json().catch(function () { return {}; });
  const alt = data
    && data.results
    && data.results.channels
    && data.results.channels[0]
    && data.results.channels[0].alternatives
    && data.results.channels[0].alternatives[0];
  return (alt && alt.transcript) || '';
}

module.exports = { transcribe, name: 'deepgram' };