// ============================================================
// voice/providers/local-whisper.js
// ------------------------------------------------------------
// Local Whisper CLI fallback. Works only on the developer's
// laptop — Render cannot reach it. Used only when cloud
// providers are unavailable.
// ============================================================

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const logger = require('../../core/logger');

function runWhisper(filePath, cmd) {
  return new Promise(function (resolve, reject) {
    const args = [
      filePath,
      '--model', process.env.WHISPER_MODEL || 'base',
      '--output_format', 'txt',
      '--output_dir', path.dirname(filePath),
    ];
    const child = spawn(cmd, args);
    let stderr = '';
    child.stderr.on('data', function (d) { stderr += d.toString(); });
    child.on('error', reject);
    child.on('close', function (code) {
      if (code !== 0) {
        return reject(new Error('whisper exited ' + code + ': ' + stderr.slice(0, 200)));
      }
      const txtPath = filePath.replace(/\.[^.]+$/, '.txt');
      try {
        const text = fs.readFileSync(txtPath, 'utf8');
        try { fs.unlinkSync(txtPath); } catch (_) {}
        resolve(text);
      } catch (err) {
        reject(err);
      }
    });
  });
}

async function transcribe(buffer, mimeType) {
  const cmd = process.env.WHISPER_CMD;
  if (!cmd) throw new Error('NO_CMD');

  const ext =
    (mimeType && mimeType.indexOf('mp4') !== -1) ? '.mp4' :
    (mimeType && mimeType.indexOf('ogg') !== -1) ? '.ogg' :
    '.webm';

  const tmpPath = path.join(os.tmpdir(), 'whisper-' + Date.now() + ext);
  fs.writeFileSync(tmpPath, buffer);

  try {
    const text = await runWhisper(tmpPath, cmd);
    return text || '';
  } finally {
    try { fs.unlinkSync(tmpPath); } catch (_) {}
  }
}

module.exports = { transcribe, name: 'whisper' };