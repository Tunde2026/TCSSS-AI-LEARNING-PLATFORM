// Business logic for authentication.
// Talks to db.users and hashes/verifies passwords. Knows nothing about HTTP.

const bcrypt = require('bcrypt');
const db     = require('../db');
const logger = require('../core/logger');

const SALT_ROUNDS = 10;

// Return shapes used by routes.js:
//   { ok: true, user }
//   { ok: false, code: 'EMAIL_TAKEN' }
//   { ok: false, code: 'NO_ACCOUNT' }
//   { ok: false, code: 'BAD_CREDENTIALS' }

async function signup({ name, email, password }) {
  const existing = await db.users.findByEmail(email);
  if (existing) {
    return { ok: false, code: 'EMAIL_TAKEN' };
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await db.users.create({ name, email, passwordHash });
  logger.info(`[auth] new user: ${user.email}`);
  return { ok: true, user };
}

async function login({ email, password }) {
  const user = await db.users.findByEmail(email);
  if (!user) {
    return { ok: false, code: 'NO_ACCOUNT' };
  }

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    return { ok: false, code: 'BAD_CREDENTIALS' };
  }

  // Strip the hash before returning
  const { password_hash, ...safe } = user;
  return { ok: true, user: safe };
}

async function getUserById(id) {
  return db.users.findById(id);
}

module.exports = { signup, login, getUserById };