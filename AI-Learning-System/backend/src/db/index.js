const pool = require('./pool');
const users = require('./queries/users');
const conversations = require('./queries/conversations');
const messages = require('./queries/messages');

module.exports = {
  pool,
  users,
  conversations,
  messages
};
