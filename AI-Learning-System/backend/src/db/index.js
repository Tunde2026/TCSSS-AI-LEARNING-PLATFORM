// ============================================================
// db/index.js
// ============================================================

const { pool, ping } = require('./pool');

const users          = require('./queries/users');
const conversations  = require('./queries/conversations');
const messages       = require('./queries/messages');
const quizzes        = require('./queries/quizzes');
const agents         = require('./queries/agents');
const flashcards     = require('./queries/flashcards');
const library        = require('./queries/library');
const documentChunks = require('./queries/documentChunks');
const settings       = require('./queries/settings');
const knowledge      = require('./queries/knowledge');
const analytics      = require('./queries/analytics');
const providerKeys   = require('./queries/providerKeys');
const auditLog       = require('./queries/auditLog');
const notes          = require('./queries/notes');
const practice       = require('./queries/practice');
const studyPlans     = require('./queries/studyPlans');

module.exports = {
  pool, ping,
  users, conversations, messages, quizzes, agents,
  flashcards, library, documentChunks, settings,
  knowledge, analytics, providerKeys, auditLog,
  notes, practice, studyPlans,
};