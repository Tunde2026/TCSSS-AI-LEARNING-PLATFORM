// ============================================================
// ai/router.js
// ------------------------------------------------------------
// Decides what should happen for a user request.
//
// Project rule 9 - the LLM decides; the application executes.
//
// Current behaviour:
//   1. Scan the latest user message for an @Name mention
//   2. If found and matches one of the user's agents, load it
//   3. Return a structured decision for ai/routes.js
// ============================================================

const agentsService = require('../agents').service;
const logger = require('../core/logger');

async function route(input) {
  const user = input.user;
  const messages = input.messages;
  const agentId = input.agentId;

  const lastUser = messages.slice().reverse().find(function (m) {
    return m.role === 'user';
  });
  const text = (lastUser && lastUser.content) || '';

  // Explicit agentId passed by the frontend takes priority
  if (agentId) {
    const agent = await agentsService.get(user.id, agentId);
    if (agent) {
      logger.debug('[router] agent by id: @' + agent.name);
      return { kind: 'chat', agent: agent, reason: 'explicit_id' };
    }
  }

  // Detect @mention in the message text
  const agent = await agentsService.resolveMention(user.id, text);
  if (agent) {
    logger.debug('[router] agent by mention: @' + agent.name);
    return { kind: 'chat', agent: agent, reason: 'mention' };
  }

  return { kind: 'chat', agent: null, reason: 'default' };
}

module.exports = { route: route };
