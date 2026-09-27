// ============================================================
// announcements/service.js
// ============================================================
const db = require('../db');
const logger = require('../core/logger');

const CATEGORIES = ['announcement', 'news', 'update'];
const PRIORITIES = ['normal', 'important', 'urgent'];
const MODES = ['modal', 'inline'];
const STYLES = ['primary', 'secondary'];
const ROLES = ['all', 'student', 'admin'];

function clampInt(v, min, max, dflt) {
  const n = parseInt(v, 10);
  if (isNaN(n)) return dflt;
  return Math.max(min, Math.min(max, n));
}

function validate(payload, isUpdate) {
  const errors = [];
  if (!isUpdate || payload.title !== undefined) {
    if (!payload.title || String(payload.title).trim().length < 2) errors.push('Title is required.');
  }
  if (!isUpdate || payload.body !== undefined) {
    if (!payload.body || String(payload.body).trim().length < 2) errors.push('Body is required.');
  }
  if (payload.category && !CATEGORIES.includes(payload.category)) errors.push('Invalid category.');
  if (payload.priority && !PRIORITIES.includes(payload.priority)) errors.push('Invalid priority.');
  if (payload.display_mode && !MODES.includes(payload.display_mode)) errors.push('Invalid display mode.');
  if (payload.action_style && !STYLES.includes(payload.action_style)) errors.push('Invalid action style.');
  if (payload.target_role && !ROLES.includes(payload.target_role)) errors.push('Invalid target role.');
  return errors;
}

function normalize(payload) {
  return {
    title: String(payload.title || '').trim().slice(0, 200),
    body: String(payload.body || '').trim().slice(0, 8000),
    category: payload.category || 'announcement',
    priority: payload.priority || 'normal',
    display_mode: payload.display_mode || 'inline',
    modal_delay_seconds: clampInt(payload.modal_delay_seconds, 0, 600, 30),
    inline_delay_seconds: clampInt(payload.inline_delay_seconds, 0, 600, 15),
    cooldown_hours: clampInt(payload.cooldown_hours, 0, 8760, 24),
    action_label: payload.action_label ? String(payload.action_label).trim().slice(0, 60) : null,
    action_url: payload.action_url ? String(payload.action_url).trim().slice(0, 500) : null,
    action_style: payload.action_style || 'primary',
    action_new_tab: payload.action_new_tab !== false,
    starts_at: payload.starts_at || null,
    expires_at: payload.expires_at || null,
    is_active: payload.is_active !== false,
    target_role: payload.target_role || 'all',
  };
}

async function listAll() { return db.announcements.listAll(); }
async function getById(id) { return db.announcements.findById(id); }

async function create(payload, adminId) {
  const errors = validate(payload, false);
  if (errors.length) return { ok: false, code: 'INVALID', errors };
  const data = normalize(payload);
  data.created_by = adminId;
  const row = await db.announcements.create(data);
  logger.info('[announcements] created "' + row.title + '" by ' + adminId);
  return { ok: true, announcement: row };
}

async function update(id, payload) {
  const errors = validate(payload, true);
  if (errors.length) return { ok: false, code: 'INVALID', errors };
  const fields = {};
  if (payload.title !== undefined)               fields.title = String(payload.title).trim().slice(0, 200);
  if (payload.body !== undefined)                fields.body = String(payload.body).trim().slice(0, 8000);
  if (payload.category !== undefined)            fields.category = payload.category;
  if (payload.priority !== undefined)            fields.priority = payload.priority;
  if (payload.display_mode !== undefined)        fields.display_mode = payload.display_mode;
  if (payload.modal_delay_seconds !== undefined) fields.modal_delay_seconds = clampInt(payload.modal_delay_seconds, 0, 600, 30);
  if (payload.inline_delay_seconds !== undefined)fields.inline_delay_seconds = clampInt(payload.inline_delay_seconds, 0, 600, 15);
  if (payload.cooldown_hours !== undefined)      fields.cooldown_hours = clampInt(payload.cooldown_hours, 0, 8760, 24);
  if (payload.action_label !== undefined)        fields.action_label = payload.action_label ? String(payload.action_label).trim().slice(0, 60) : null;
  if (payload.action_url !== undefined)          fields.action_url = payload.action_url ? String(payload.action_url).trim().slice(0, 500) : null;
  if (payload.action_style !== undefined)        fields.action_style = payload.action_style;
  if (payload.action_new_tab !== undefined)      fields.action_new_tab = payload.action_new_tab !== false;
  if (payload.starts_at !== undefined)           fields.starts_at = payload.starts_at || null;
  if (payload.expires_at !== undefined)          fields.expires_at = payload.expires_at || null;
  if (payload.is_active !== undefined)           fields.is_active = payload.is_active !== false;
  if (payload.target_role !== undefined)         fields.target_role = payload.target_role;

  const row = await db.announcements.update(id, fields);
  if (!row) return { ok: false, code: 'NOT_FOUND' };
  return { ok: true, announcement: row };
}

async function remove(id) {
  const ok = await db.announcements.softDelete(id);
  return ok ? { ok: true } : { ok: false, code: 'NOT_FOUND' };
}

async function listActiveForUser(user) {
  const rows = await db.announcements.listActiveForUser(user.id, user.role);
  return rows.map(function (r) {
    return {
      id: r.id,
      title: r.title,
      body: r.body,
      category: r.category,
      priority: r.priority,
      display_mode: r.display_mode,
      modal_delay_seconds: r.modal_delay_seconds,
      inline_delay_seconds: r.inline_delay_seconds,
      cooldown_hours: r.cooldown_hours,
      action_label: r.action_label,
      action_url: r.action_url,
      action_style: r.action_style,
      action_new_tab: r.action_new_tab,
      dismissed_at: r.dismissed_at,
      created_at: r.created_at,
    };
  });
}

async function dismiss(announcementId, userId) {
  const ann = await db.announcements.findById(announcementId);
  if (!ann) return { ok: false, code: 'NOT_FOUND' };
  await db.announcements.recordDismissal(announcementId, userId);
  return { ok: true };
}

/* ---------- View tracking ---------- */
async function recordView(announcementId, userId, displayMode) {
  const ann = await db.announcements.findById(announcementId);
  if (!ann) return { ok: false, code: 'NOT_FOUND' };
  await db.announcements.recordView(announcementId, userId, displayMode);
  return { ok: true };
}

async function listViewers(announcementId) {
  const ann = await db.announcements.findById(announcementId);
  if (!ann) return { ok: false, code: 'NOT_FOUND' };
  const viewers = await db.announcements.listViewers(announcementId);

  const stats = {
    unique_viewers: viewers.length,
    dismissed:      viewers.filter(function (v) { return v.dismissed_at; }).length,
    not_dismissed:  viewers.filter(function (v) { return !v.dismissed_at; }).length,
    total_views:    viewers.reduce(function (sum, v) { return sum + (v.view_count || 0); }, 0),
    first_view_at:  viewers.length ? viewers[viewers.length - 1].first_viewed_at : null,
    last_view_at:   viewers.length ? viewers[0].last_viewed_at : null,
  };

  return {
    ok: true,
    announcement: {
      id: ann.id,
      title: ann.title,
      category: ann.category,
      display_mode: ann.display_mode,
      priority: ann.priority,
      created_at: ann.created_at,
    },
    stats,
    viewers,
  };
}

async function clearViews(announcementId) {
  const ann = await db.announcements.findById(announcementId);
  if (!ann) return { ok: false, code: 'NOT_FOUND' };
  const removed = await db.announcements.clearViews(announcementId);
  return { ok: true, removed };
}

module.exports = {
  listAll, getById, create, update, remove,
  listActiveForUser, dismiss,
  recordView, listViewers, clearViews,
};
