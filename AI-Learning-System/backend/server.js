// Entry point for the AI Learning Platform backend.

const path    = require('path');
const express = require('express');
const helmet  = require('helmet');
const cors    = require('cors');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);

const core    = require('./src/core');
const db      = require('./src/db');
const auth    = require('./src/auth');
const ai      = require('./src/ai');

const { config, logger } = core;

const app = express();

// Trust the first proxy in front of us (needed for correct IPs behind HTTPS).
app.set('trust proxy', 1);

// ---- Security headers ----
app.use(helmet({
  // Allow the frontend to load Google Fonts used by shell.css
  contentSecurityPolicy: false,
}));

// ---- CORS ----
// Same-origin in dev (Express serves the frontend), so CORS is mostly
// for future split deployments. Tighten `origin` before production.
app.use(cors({
  origin: true,
  credentials: true,
}));

// ---- Body parsing ----
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ---- Sessions (stored in PostgreSQL) ----
app.use(session({
  store: new PgSession({
    pool: db.pool,
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

// ---- Attach req.user if logged in (never blocks) ----
app.use(auth.attachUser);

// ---- Request logger ----
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    logger.info(`${req.method} ${req.originalUrl} → ${res.statusCode} (${ms}ms)`);
  });
  next();
});

// ---- Health endpoints (no rate limit) ----
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

// ---- API routes ----
app.use('/api', core.apiLimiter);          // apply to all /api/*
app.use('/api/auth', auth.router);
app.use('/api/ai',   ai.router);

// Uncomment as each module is built:
// app.use('/api/tools',   require('./src/tools').router);
// app.use('/api/agents',  require('./src/agents').router);
// app.use('/api/library', require('./src/library').router);
// app.use('/api/admin',   require('./src/admin').router);

// ---- Static frontend ----
// Serves frontend/index.html at "/" and every page under /frontend.
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// ---- 404 for unknown API routes ----
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ---- Error handler (must be LAST) ----
app.use(core.errorHandler);

// ---- Boot ----
app.listen(config.port, () => {
  logger.info(`Server listening on http://localhost:${config.port}`);
  logger.info(`Environment: ${config.nodeEnv}`);
  if (config.nodeEnv !== 'production') {
    logger.info(`Frontend:  http://localhost:${config.port}/`);
  }
});

module.exports = app;