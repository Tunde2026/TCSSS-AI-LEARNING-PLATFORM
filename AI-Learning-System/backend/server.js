// ============================================================
// server.js
// ------------------------------------------------------------

const path      = require('path');
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

core.settings.loadFromDb().catch(() => {});
ai.keyStore.loadAndApply().catch(() => {});

// Ensure upload dirs exist at boot.
try { require('./src/library/storage').ensureUploadDirs(); } catch (_) {}

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

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

app.use(auth.attachUser);

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    logger.info(`${req.method} ${req.originalUrl} → ${res.statusCode} (${ms}ms)`);
  });
  next();
});

// ---- Health ----
app.get('/health', (req, res) => {
  res.json({ status: 'ok', env: config.nodeEnv, time: new Date().toISOString() });
});

app.get('/health/db', async (req, res) => {
  try {
    const now = await db.ping();
    res.json({ status: 'ok', db_time: now });
  } catch (err) {
    logger.error('DB health check failed:', err.message);
    res.status(503).json({ status: 'db_unavailable', error: err.message });
  }
});

// ---- Public platform info (used by login page + sidebar) ----
app.get('/api/platform/info', async (req, res, next) => {
  try {
    const name = await core.settings.getSetting('platform.name', 'AI Learning Platform');
    const logoUrl = await core.settings.getSetting('platform.logo_url', '');
    res.json({ name, logoUrl });
  } catch (err) { next(err); }
});

// ---- API routes ----
app.use('/api', core.apiLimiter);
app.use('/api/auth',          auth.router);
app.use('/api/ai',            ai.router);
app.use('/api/conversations', require('./src/conversations').router);
app.use('/api/tools',         require('./src/tools').router);
app.use('/api/agents',        require('./src/agents').router);
app.use('/api/library',       require('./src/library').router);
app.use('/api/admin',         require('./src/admin').router);

// ---- Static uploads (logo, documents) ----
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads'), {
  maxAge: '1d',
  fallthrough: true,
}));

// ---- Static frontend ----
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// ---- 404 for API ----
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ---- Error handler ----
app.use(core.errorHandler);

app.listen(config.port, () => {
  logger.info(`Server listening on http://localhost:${config.port}`);
  logger.info(`Environment: ${config.nodeEnv}`);
  if (config.nodeEnv !== 'production') {
    logger.info(`Frontend:  http://localhost:${config.port}/`);
  }
});

module.exports = app;