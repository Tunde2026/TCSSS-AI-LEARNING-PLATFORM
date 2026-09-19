// Public interface for the db module.
// Everything outside this folder imports from here only.

const { pool, ping } = require('./pool');
const users         = require('./queries/users');
const conversations = require('./queries/conversations');
const messages      = require('./queries/messages');

module.exports = {
  pool,
  ping,
  users,
  conversations,
  messages,
};