// ============================================================
// core/settings.js
// ------------------------------------------------------------
// In-memory cache of system_settings, loaded from the database.
// Other modules call getSetting('platform.name') etc.
//
// Reload happens:
//   - On server start
//   - Whenever the admin updates a setting
//   - Automatically every 60s as a fallback
// ============================================================

const db     = require('../db');
const logger = require('./logger');

const CACHE_TTL_MS = 60 * 1000;

let cache = new Map();
let lastLoaded = 0;
let loading = null;

async function loadFromDb() {
  if (loading) return loading;
  loading = (async () => {
    try {
      const rows = await db.settings.listAll();
      const next = new Map();
      for (const row of rows) {
        next.set(row.key, { value: row.value, type: row.type });
      }
      cache = next;
      lastLoaded = Date.now();
      logger.debug(`[settings] loaded ${rows.length} settings`);
    } catch (err) {
      logger.warn('[settings] load failed:', err.message);
    } finally {
      loading = null;
    }
  })();
  return loading;
}

async function ensureFresh() {
  if (Date.now() - lastLoaded > CACHE_TTL_MS) {
    await loadFromDb();
  }
}

async function getSetting(key, fallback = null) {
  await ensureFresh();
  const entry = cache.get(key);
  return entry ? entry.value : fallback;
}

async function setSetting(key, value, type) {
  await ensureFresh();
  cache.set(key, { value, type });
}

async function setMany(entries) {
  for (const e of entries) cache.set(e.key, { value: e.value, type: e.type });
  lastLoaded = Date.now();
}

async function reload() {
  lastLoaded = 0;
  await loadFromDb();
}

async function getAll() {
  await ensureFresh();
  const out = {};
  for (const [key, entry] of cache.entries()) {
    out[key] = entry.value;
  }
  return out;
}

module.exports = {
  getSetting,
  setSetting,
  setMany,
  reload,
  getAll,
  loadFromDb,
};