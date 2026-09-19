const express = require('express');
const router  = express.Router();
const { chat, _debugState } = require('./gateway');
const { route } = require('./router');
const db      = require('../db');
const logger  = require('../core/logger');
const { requireLogin } = require('../auth');

const retrieval = require('../library/retrieval');
const websearch = require('../tools/websearch/service');

// Decide if the message likely needs current web info.
// Simple keyword heuristic — fast, deterministic, no AI call.
function needsWebSearch(text) {
  const t = String(text || '').toLowerCase();
  const triggers = [
    'latest', 'current', 'today', 'this year', 'this week',
    'recent', 'news', '2025', '2026', '2027',
    'right now', 'up to date', 'update on',
  ];
  return triggers.some(k => t.includes(k));
}

function buildSystemContext(agent) {
  if (!agent) return null;
  let prompt = agent.system_prompt;
  const extras = [];
  if (agent.subject)        extras.push(`Subject: ${agent.subject}`);
  if (agent.level)          extras.push(`Education level: ${agent.level}`);
  if (agent.learning_style) extras.push(`Preferred teaching style: ${agent.learning_style}`);
  if (extras.length) prompt += '\n\n' + extras.join('\n');
  return prompt;
}

router.post('/chat', requireLogin, async (req, res, next) => {
  const { messages, conversationId, agentId } = req.body || {};

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages must be a non-empty array' });
  }
  for (const m of messages) {
    if (!m || typeof m.role !== 'string' || typeof m.content !== 'string') {
      return res.status(400).json({ error: 'each message needs role and content' });
    }
  }

  const lastUser = [...messages].reverse().find(m => m.role === 'user');
  if (!lastUser) {
    return res.status(400).json({ error: 'at least one user message is required' });
  }

  try {
    // 1. Ensure a conversation exists
    let conv;
    if (conversationId) {
      const list = await db.conversations.listByUser(req.user.id);
      conv = list.find(c => c.id === conversationId);
      if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    } else {
      const title = lastUser.content.slice(0, 60) || 'New conversation';
      conv = await db.conversations.create(req.user.id, title);
    }

    // 2. Save the user message
    await db.messages.create({
      conversationId: conv.id,
      role: 'user',
      content: lastUser.content,
    });

    // 3. Route — resolve @mention if present
    const decision = await route({
      user: req.user,
      messages,
      agentId: agentId || null,
    });

    // 4. Build the message list to send to the gateway
    let gatewayMessages = [...messages];
    const injectedSystemBlocks = [];

    if (decision.agent) {
      const sys = buildSystemContext(decision.agent);
      if (sys) injectedSystemBlocks.push(sys);
    }

    // 4a. Library retrieval (RAG)
    try {
      const { contextText } = await retrieval.retrieveContext(lastUser.content);
      if (contextText) {
        injectedSystemBlocks.push(contextText);
      }
    } catch (err) {
      logger.warn('[ai/chat] retrieval failed:', err.message);
    }

    // 4b. Web search (when the message looks like it needs current info)
    let searchMeta = null;
    if (needsWebSearch(lastUser.content) && websearch.isEnabled()) {
      try {
        const r = await websearch.search(lastUser.content, { count: 5 });
        if (r.ok && r.results.length) {
          injectedSystemBlocks.push(
            websearch.buildContextBlock(lastUser.content, r.results)
          );
          searchMeta = { count: r.results.length };
        }
      } catch (err) {
        logger.warn('[ai/chat] web search failed:', err.message);
      }
    }

    // Prepend any system blocks we produced
    if (injectedSystemBlocks.length) {
      const combined = injectedSystemBlocks.join('\n\n=====\n\n');
      gatewayMessages = [
        { role: 'system', content: combined },
        ...gatewayMessages,
      ];
    }

    // 5. Call the gateway
    const result = await chat({ messages: gatewayMessages });

    // 6. Save the assistant reply
    const saved = await db.messages.create({
      conversationId: conv.id,
      role: 'assistant',
      content: result.text,
      provider: result.provider,
    });

    await db.conversations.touch(conv.id);

    res.json({
      reply: result.text,
      provider: result.provider,
      conversationId: conv.id,
      messageId: saved.id,
      agent: decision.agent
        ? { id: decision.agent.id, name: decision.agent.name }
        : null,
      usedLibrary: injectedSystemBlocks.length > 0 && !decision.agent,
      usedWebSearch: !!searchMeta,
    });

  } catch (err) {
    logger.error('[ai/chat]', err.message, err.attempts || []);

    if (err.message === 'REQUEST_REJECTED') {
      return res.status(400).json({ error: 'The request was rejected by the model.' });
    }
    if (err.message === 'NO_PROVIDERS_AVAILABLE') {
      return res.status(503).json({ error: 'No AI providers are configured.' });
    }
    if (err.message === 'ALL_PROVIDERS_FAILED') {
      return res.status(503).json({ error: 'AI temporarily unavailable. Please try again.' });
    }
    next(err);
  }
});

router.get('/status', requireLogin, (req, res) => {
  res.json(_debugState());
});

module.exports = router;