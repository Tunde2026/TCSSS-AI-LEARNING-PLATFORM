// ============================================================
// server.js
// ------------------------------------------------------------
// Entry point for the AI Learning Platform backend.
// ============================================================

const path      = require('path');
const fs        = require('fs');
const express   = require('express');
const helmet    = require('helmet');
const cors      = require('cors');
const session   = require('express-session');
const PgSession = require('connect-pg-simple')(session);

const core = require('./src/core');
const db   = require('./src/db');
const auth = require('./src/auth');
const ai   = require('./src/ai');

const { config, logger } = core;
const app = express();

app.set('trust proxy', 1);

// ---- Boot-time caches (non-blocking) ----
core.settings.loadFromDb().catch(function () {});
ai.keyStore.loadAndApply().catch(function () {});

// ---- Ensure upload folders exist ----
try {
  const storage = require('./src/library/storage');
  if (storage && storage.ensureUploadDirs) storage.ensureUploadDirs();
} catch (_) {}

try {
  fs.mkdirSync(path.join(__dirname, '..', 'uploads', 'generated'), { recursive: true });
  fs.mkdirSync(path.join(__dirname, '..', 'uploads', 'chat'), { recursive: true });
} catch (_) {}

// ---- Start library auto-fetcher (background job) ----
try {
  const fetcher = require('./src/library/fetcher');
  if (fetcher && fetcher.start) fetcher.start();
} catch (err) {
  logger.warn('Fetcher failed to start: ' + err.message);
}

// ---- Security headers ----
app.use(helmet({ contentSecurityPolicy: false }));

// ---- CORS ----
app.use(cors({ origin: true, credentials: true }));

// ---- Body parsing ----
// 50 MB JSON limit — helps with chat attachments metadata and
// large API payloads. File uploads use multipart, not JSON.
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ---- Sessions (PostgreSQL-backed) ----
app.use(session({
  store: new PgSession({
    conString: config.db.url,
    tableName: 'session',
    createTableIfMissing: true,
  }),
  name: 'connect.sid',
  secret: config.session.secret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.nodeEnv === 'production',
    maxAge: config.session.maxAge,
  },
}));

// ---- Attach req.user if logged in ----
app.use(auth.attachUser);

// ---- Request logger ----
app.use(function (req, res, next) {
  const start = Date.now();
  res.on('finish', function () {
    const ms = Date.now() - start;
    logger.info(req.method + ' ' + req.originalUrl + ' → ' + res.statusCode + ' (' + ms + 'ms)');
  });
  next();
});

// ---- Health ----
app.get('/health', function (req, res) {
  res.json({ status: 'ok', env: config.nodeEnv, time: new Date().toISOString() });
});

app.get('/health/db', async function (req, res) {
  try {
    const now = await db.ping();
    res.json({ status: 'ok', db_time: now });
  } catch (err) {
    logger.error('DB health check failed: ' + err.message);
    res.status(503).json({ status: 'db_unavailable', error: err.message });
  }
});

// ---- Platform info ----
app.get('/api/platform/info', async function (req, res, next) {
  try {
    const name = await core.settings.getSetting('platform.name', 'AI Learning Platform');
    const logoUrl = await core.settings.getSetting('platform.logo_url', '');
    res.json({ name: name, logoUrl: logoUrl });
  } catch (err) { next(err); }
});

// ---- API routes ----
app.use('/api', core.apiLimiter);
app.use('/api/auth',          auth.router);
app.use('/api/ai',            ai.router);
app.use('/api/conversations', require('./src/conversations').router);
app.use('/api/chat',          require('./src/chat').router);
app.use('/api/tools',         require('./src/tools').router);
app.use('/api/agents',        require('./src/agents').router);
app.use('/api/library',       require('./src/library').router);
app.use('/api/voice',         require('./src/voice').router);
app.use('/api/admin',         require('./src/admin').router);
app.use('/api/support',       require('./src/support').router);

// ---- Static uploads ----
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads'), {
  maxAge: '1d',
  fallthrough: true,
}));

// ---- Static frontend ----
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// ---- 404 for unknown API routes ----
app.use('/api', function (req, res) {
  res.status(404).json({ error: 'Not found' });
});

// ---- Error handler (must be LAST) ----
app.use(core.errorHandler);

// ---- Boot ----
app.listen(config.port, function () {
  logger.info('Server listening on http://localhost:' + config.port);
  logger.info('Environment: ' + config.nodeEnv);
  if (config.nodeEnv !== 'production') {
    logger.info('Frontend:  http://localhost:' + config.port + '/');
  }
});

module.exports = app;
