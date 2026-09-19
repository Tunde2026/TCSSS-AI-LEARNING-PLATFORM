// ============================================================
// auth/service.js
// ------------------------------------------------------------
// Business logic for authentication.
// ============================================================

const bcrypt = require('bcrypt');
const db     = require('../db');
const logger = require('../core/logger');

const SALT_ROUNDS = 10;

async function signup({ name, email, password }) {
  const existing = await db.users.findByEmail(email);
  if (existing) return { ok: false, code: 'EMAIL_TAKEN' };

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await db.users.create({ name, email, passwordHash });
  logger.info(`[auth] new user: ${user.email}`);
  return { ok: true, user };
}

async function login({ email, password }) {
  const user = await db.users.findByEmail(email);
  if (!user) return { ok: false, code: 'NO_ACCOUNT' };

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) return { ok: false, code: 'BAD_CREDENTIALS' };

  // Suspended check happens AFTER credential verification, so we don't
  // reveal to strangers that an account exists.
  if (user.suspended) {
    return {
      ok: false,
      code: 'SUSPENDED',
      suspendedReason: user.suspended_reason || null,
      suspendedAt: user.suspended_at || null,
    };
  }

  const { password_hash, ...safe } = user;
  return { ok: true, user: safe };
}

async function getUserById(id) {
  return db.users.findById(id);
}

module.exports = { signup, login, getUserById };