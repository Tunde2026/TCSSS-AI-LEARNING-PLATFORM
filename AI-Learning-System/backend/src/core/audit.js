// ============================================================
// core/audit.js
// ------------------------------------------------------------
// Convenience wrapper around db.auditLog.insert.
// Every admin mutation calls this. Failures are logged but
// never block the actual operation.
// ============================================================

const db     = require('../db');
const logger = require('./logger');

async function log({ req, action, targetType, targetId, targetLabel, details }) {
  try {
    await db.auditLog.insert({
      adminId:     req.user ? req.user.id : null,
      adminEmail:  req.user ? req.user.email : null,
      action,
      targetType:  targetType || null,
      targetId:    targetId ? String(targetId) : null,
      targetLabel: targetLabel || null,
      details:     details || null,
      ip:          req.ip || null,
    });
  } catch (err) {
    logger.warn('[audit] failed to log:', err.message);
  }
}

module.exports = { log };