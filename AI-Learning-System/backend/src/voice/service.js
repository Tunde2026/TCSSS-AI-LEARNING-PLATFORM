// ============================================================
// voice/service.js
// ------------------------------------------------------------
// Speech-to-text via the local Whisper CLI.
//
// Requires openai-whisper installed:
//     pip install openai-whisper
//
// The `whisper` command must be on PATH. If Node cannot find it,
// set WHISPER_CMD in .env to the full path of whisper.exe.
// ============================================================

const fs      = require('fs');
const path    = require('path');
const os      = require('os');
const crypto  = require('crypto');
const { spawn } = require('child_process');
const logger  = require('../core/logger');

const DEFAULT_MODEL   = process.env.WHISPER_MODEL || 'base';
const TIMEOUT_MS      = 5 * 60 * 1000;   // 5 minutes max per clip

function whisperCommand() {
  return process.env.WHISPER_CMD || 'whisper';
}

// Pick a safe extension for the temp file based on the audio mimetype.
function extFromMime(mime) {
  if (!mime) return '.webm';
  if (mime.indexOf('webm')  !== -1) return '.webm';
  if (mime.indexOf('ogg')   !== -1) return '.ogg';
  if (mime.indexOf('mp4')   !== -1) return '.mp4';
  if (mime.indexOf('mpeg')  !== -1 || mime.indexOf('mp3') !== -1) return '.mp3';
  if (mime.indexOf('wav')   !== -1) return '.wav';
  if (mime.indexOf('m4a')   !== -1) return '.m4a';
  return '.webm';
}

// Run the whisper CLI. Resolves when it finishes; rejects on error/timeout.
function runWhisper({ audioPath, outputDir, model }) {
  return new Promise((resolve, reject) => {
    const cmd = whisperCommand();
    const args = [
      audioPath,
      '--model', model,
      '--output_format', 'txt',
      '--output_dir', outputDir,
      '--fp16', 'False',
      '--verbose', 'False',
    ];

    let stderr = '';
    let stdout = '';

    let proc;
    try {
      proc = spawn(cmd, args, { shell: false });
    } catch (err) {
      return reject(new Error('WHISPER_NOT_FOUND'));
    }

    const timer = setTimeout(() => {
      try { proc.kill(); } catch (_) {}
      reject(new Error('TRANSCRIBE_TIMEOUT'));
    }, TIMEOUT_MS);

    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.stderr.on('data', d => { stderr += d.toString(); });

    proc.on('error', (err) => {
      clearTimeout(timer);
      logger.error('[voice] spawn error:', err.message);
      if (err.code === 'ENOENT') return reject(new Error('WHISPER_NOT_FOUND'));
      reject(new Error('WHISPER_ERROR'));
    });

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        logger.warn('[voice] whisper exited', code, '::', stderr.slice(0, 300));
        return reject(new Error('TRANSCRIBE_FAILED'));
      }
      resolve({ stdout, stderr });
    });
  });
}

// Full pipeline: write buffer → temp file → whisper → read .txt → clean up.
async function transcribe({ buffer, mimetype, model }) {
  if (!buffer || !buffer.length) {
    return { ok: false, code: 'NO_AUDIO' };
  }
  if (buffer.length > 25 * 1024 * 1024) {
    return { ok: false, code: 'TOO_LARGE' };
  }

  const useModel = model || DEFAULT_MODEL;
  const id       = crypto.randomBytes(8).toString('hex');
  const workDir  = path.join(os.tmpdir(), 'ai-learning-voice-' + id);

  try {
    fs.mkdirSync(workDir, { recursive: true });
    const ext       = extFromMime(mimetype);
    const audioPath = path.join(workDir, 'input' + ext);
    fs.writeFileSync(audioPath, buffer);

    logger.info(`[voice] transcribing ${buffer.length} bytes with model "${useModel}"`);

    try {
      await runWhisper({ audioPath, outputDir: workDir, model: useModel });
    } catch (err) {
      const map = {
        WHISPER_NOT_FOUND: 'WHISPER_NOT_FOUND',
        TRANSCRIBE_TIMEOUT: 'TIMEOUT',
        TRANSCRIBE_FAILED: 'TRANSCRIBE_FAILED',
        WHISPER_ERROR: 'TRANSCRIBE_FAILED',
      };
      return { ok: false, code: map[err.message] || 'TRANSCRIBE_FAILED' };
    }

    // Whisper writes input.txt
    const txtPath = path.join(workDir, 'input.txt');
    if (!fs.existsSync(txtPath)) {
      return { ok: false, code: 'NO_OUTPUT' };
    }

    const text = fs.readFileSync(txtPath, 'utf8').trim();
    logger.info(`[voice] transcribed ${text.length} characters`);

    return { ok: true, text };
  } catch (err) {
    logger.error('[voice] unexpected error:', err.message);
    return { ok: false, code: 'UNEXPECTED' };
  } finally {
    // Always clean up the temp directory
    try { fs.rmSync(workDir, { recursive: true, force: true }); } catch (_) {}
  }
}

// Check whether the whisper command is available.
async function isAvailable() {
  return new Promise((resolve) => {
    const cmd = whisperCommand();
    let proc;
    try {
      proc = spawn(cmd, ['--help'], { shell: false });
    } catch (_) { return resolve(false); }
    const timer = setTimeout(() => { try { proc.kill(); } catch (_) {} resolve(false); }, 5000);
    proc.on('error', () => { clearTimeout(timer); resolve(false); });
    proc.on('close', (code) => { clearTimeout(timer); resolve(code === 0); });
  });
}

module.exports = { transcribe, isAvailable, DEFAULT_MODEL };