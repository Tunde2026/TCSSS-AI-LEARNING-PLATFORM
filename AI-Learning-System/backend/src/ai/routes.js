const express = require('express');
const router  = express.Router();
const { chat, _debugState } = require('./gateway');
const { route } = require('./router');
const db      = require('../db');
const logger  = require('../core/logger');
const { requireLogin } = require('../auth');
const retrieval   = require('../library/retrieval');
const websearch   = require('../tools/websearch/service');
const attachments = require('../chat/attachments');
const imagegen    = require('../tools/imagegen/service');
const imagesearch = require('../tools/imagesearch/service');

// --- NEW: Tool service imports ---
const quizService      = require('../tools/quiz/service');
const flashcardService = require('../tools/flashcards/service');

function needsWebSearch(text) {
  const t = String(text || '').toLowerCase();
  const triggers = [
    'latest', 'current', 'today', 'this year', 'this week',
    'recent', 'news', '2025', '2026', '2027',
    'right now', 'up to date', 'update on',
  ];
  return triggers.some(function (k) { return t.indexOf(k) !== -1; });
}

function detectGenerateIntent(text) {
  const t = String(text || '').toLowerCase();
  const verbs = ['draw', 'generate image', 'generate an image', 'create image',
    'create an image', 'make an image', 'make a picture',
    'illustrate', 'picture of', 'image of', 'render'];
  const nouns = ['image', 'picture', 'illustration', 'drawing', 'artwork', 'diagram'];
  return verbs.some(function (v) { return t.indexOf(v) !== -1; }) &&
         nouns.some(function (n) { return t.indexOf(n) !== -1; });
}

function detectSearchIntent(text) {
  const t = String(text || '').toLowerCase();
  const verbs = ['show me a photo', 'show me photos', 'find a photo', 'find photos',
    'real photo', 'real picture', 'actual photo', 'actual picture',
    'photos of', 'pictures of', 'real images of'];
  return verbs.some(function (v) { return t.indexOf(v) !== -1; });
}

function extractImagePrompt(text) {
  return String(text || '')
    .replace(/^(please\s+)?(can you\s+)?(draw|generate|create|make|render|illustrate)\s+(me\s+)?(an?\s+)?/i, '')
    .replace(/\b(image|picture|illustration|drawing|artwork|photo)\b\s*(of|showing)?/gi, '')
    .replace(/\bfor me\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// --- NEW: Tool intent detection ---
function detectQuizIntent(text) {
  const t = String(text || '').toLowerCase();
  return /(?:create|make|generate|give me|start|prepare|set up)\s+(?:a\s+)?(?:quiz|test|exam|assessment|questions)/i.test(t) ||
         /(?:quiz|test|exam|questions)\s+(?:me|on|about|for)/i.test(t);
}

function detectFlashcardIntent(text) {
  const t = String(text || '').toLowerCase();
  return /(?:create|make|generate|give me)\s+(?:some\s+)?flashcards?/i.test(t) ||
         /flashcards?\s+(?:for|on|about|covering)/i.test(t);
}

function extractTopic(text) {
  return String(text || '')
    .replace(/^(please\s+)?(?:can you\s+)?(?:create|make|generate|give me|start|prepare|set up)\s+(?:a\s+)?(?:quiz|test|exam|assessment|some\s+flashcards?|flashcards?|questions?)\s*(?:on|about|for|covering)?\s*/i, '')
    .replace(/\b(?:quiz|test|exam|assessment|flashcards?|questions?)\s*(?:on|about|for|covering)\s*/i, '')
    .replace(/[?.!]+$/, '')
    .trim() || 'general knowledge';
}

function buildSystemContext(agent) {
  if (!agent) return null;
  let prompt = agent.system_prompt;
  const extras = [];
  if (agent.subject)        extras.push('Subject: ' + agent.subject);
  if (agent.level)          extras.push('Education level: ' + agent.level);
  if (agent.learning_style) extras.push('Preferred teaching style: ' + agent.learning_style);
  if (extras.length) prompt += '\n\n' + extras.join('\n');
  return prompt;
}

router.post('/chat', requireLogin, async (req, res, next) => {
  const body = req.body || {};
  const messages = body.messages;
  const conversationId = body.conversationId;
  const agentId = body.agentId;
  const attachmentIds = body.attachmentIds;

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages must be a non-empty array' });
  }
  for (const m of messages) {
    if (!m || typeof m.role !== 'string' || typeof m.content !== 'string') {
      return res.status(400).json({ error: 'each message needs role and content' });
    }
  }
  const lastUser = messages.slice().reverse().find(function (m) { return m.role === 'user'; });
  if (!lastUser) {
    return res.status(400).json({ error: 'at least one user message is required' });
  }

  try {
    let conv;
    if (conversationId) {
      const list = await db.conversations.listByUser(req.user.id);
      conv = list.find(function (c) { return c.id === conversationId; });
      if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    } else {
      const title = lastUser.content.slice(0, 60) || 'New conversation';
      conv = await db.conversations.create(req.user.id, title);
    }

    if (Array.isArray(attachmentIds) && attachmentIds.length) {
      await db.chatAttachments.linkToConversation(attachmentIds, conv.id);
    }

    await db.messages.create({
      conversationId: conv.id,
      role: 'user',
      content: lastUser.content,
    });

    const decision = await route({
      user: req.user,
      messages: messages,
      agentId: agentId || null,
    });

    let gatewayMessages = messages.slice();
    const injectedSystemBlocks = [];
    const responseImages = [];
    
    // --- NEW: Tool results array ---
    const toolResults = [];

    if (decision.agent) {
      const sys = buildSystemContext(decision.agent);
      if (sys) injectedSystemBlocks.push(sys);
    }

    if (Array.isArray(attachmentIds) && attachmentIds.length) {
      try {
        const attCtx = await attachments.buildContextFor(attachmentIds, req.user.id);
        if (attCtx) injectedSystemBlocks.push(attCtx);
      } catch (err) {
        logger.warn('[ai/chat] attachment context failed: ' + err.message);
      }
    }

    const userText = lastUser.content;

    // --- NEW: Quiz tool detection and execution ---
    if (detectQuizIntent(userText)) {
      const topic = extractTopic(userText);
      try {
        const quiz = await quizService.generate({
          topic: topic,
          count: 5,
          difficulty: 'medium',
          userId: req.user.id,
          title: 'Quiz: ' + topic
        });
        if (quiz && quiz.id) {
          toolResults.push({
            type: 'quiz',
            id: quiz.id,
            title: quiz.title || 'Quiz on ' + topic,
            topic: topic,
            count: quiz.count || 5
          });
          injectedSystemBlocks.push(
            'SYSTEM ACTION: You have automatically generated a ' + (quiz.count || 5) +
            '-question quiz on "' + topic + '". Tell the student the quiz is ready and they can click the card below to start it.'
          );
        }
      } catch (err) {
        logger.warn('[ai/chat] quiz generation failed: ' + err.message);
      }
    }

    // --- NEW: Flashcard tool detection and execution ---
    if (detectFlashcardIntent(userText)) {
      const topic = extractTopic(userText);
      try {
        const deck = await flashcardService.generate({
          topic: topic,
          count: 10,
          userId: req.user.id,
          title: 'Flashcards: ' + topic
        });
        if (deck && deck.id) {
          toolResults.push({
            type: 'flashcards',
            id: deck.id,
            title: deck.title || 'Flashcards on ' + topic,
            topic: topic,
            count: deck.count || 10
          });
          injectedSystemBlocks.push(
            'SYSTEM ACTION: You have automatically generated a flashcard deck on "' + topic + '". Tell the student it is ready below.'
          );
        }
      } catch (err) {
        logger.warn('[ai/chat] flashcard generation failed: ' + err.message);
      }
    }

    if (detectSearchIntent(userText) && imagesearch.isEnabled()) {
      const query = extractImagePrompt(userText) || userText;
      try {
        const r = await imagesearch.search(query, { count: 6 });
        if (r.ok && r.images.length) {
          r.images.forEach(function (img) {
            responseImages.push({
              url: img.url,
              thumb: img.thumb,
              source: 'pexels',
              author: img.author,
              sourceUrl: img.sourceUrl,
              alt: img.alt,
            });
          });
          injectedSystemBlocks.push(
            'The student asked for real photos of "' + query + '". ' +
            'You have retrieved ' + r.images.length + ' images. ' +
            'Briefly introduce them in one or two sentences.'
          );
        }
      } catch (err) {
        logger.warn('[ai/chat] image search failed: ' + err.message);
      }
    } else if (detectGenerateIntent(userText)) {
      const prompt = extractImagePrompt(userText) || userText;
      try {
        const r = await imagegen.generate({ prompt: prompt, model: 'flux', width: 1024, height: 1024 });
        if (r.ok) {
          responseImages.push({
            url: r.image.url,
            source: 'pollinations',
            prompt: r.image.prompt,
            width: r.image.width,
            height: r.image.height,
            alt: r.image.prompt,
          });
          injectedSystemBlocks.push(
            'The student asked you to draw "' + prompt + '". ' +
            'You have created an image. Introduce it in one or two sentences.'
          );
        }
      } catch (err) {
        logger.warn('[ai/chat] image generation failed: ' + err.message);
      }
    }

    let libraryUsed = false;
    try {
      const rc = await retrieval.retrieveContext(lastUser.content);
      if (rc.contextText) {
        injectedSystemBlocks.push(rc.contextText);
        libraryUsed = true;
      }
    } catch (err) {
      logger.warn('[ai/chat] retrieval failed: ' + err.message);
    }

    let searchMeta = null;
    if (needsWebSearch(lastUser.content) && websearch.isEnabled()) {
      try {
        const r = await websearch.search(lastUser.content, { count: 5 });
        if (r.ok && r.results.length) {
          injectedSystemBlocks.push(
            websearch.buildContextBlock(lastUser.content, r.results)
          );
          searchMeta = {
            sources: r.results.slice(0, 5).map(function (x) {
              return {
                title: x.title, url: x.url,
                snippet: (x.description || '').slice(0, 200),
              };
            }),
            keyIndex: r.keyIndex || 1,
            keyCount: r.keyCount || 1,
          };
        }
      } catch (err) {
        logger.warn('[ai/chat] web search threw: ' + err.message);
      }
    }

    if (injectedSystemBlocks.length) {
      const combined = injectedSystemBlocks.join('\n\n=====\n\n');
      gatewayMessages = [{ role: 'system', content: combined }].concat(gatewayMessages);
    }

    const result = await chat({ messages: gatewayMessages });

    // Build media object for storage
    var media = null;
    if (responseImages.length || searchMeta) {
      media = {};
      if (responseImages.length) media.images = responseImages;
      if (searchMeta) media.webSearch = searchMeta;
    }

    const saved = await db.messages.create({
      conversationId: conv.id,
      role: 'assistant',
      content: result.text,
      provider: result.provider,
      media: media,
    });

    await db.conversations.touch(conv.id);

    res.json({
      reply: result.text,
      provider: result.provider,
      conversationId: conv.id,
      messageId: saved.id,
      agent: decision.agent ? { id: decision.agent.id, name: decision.agent.name } : null,
      libraryUsed: libraryUsed,
      webSearch: searchMeta,
      images: responseImages.length ? responseImages : null,
      tools: toolResults.length ? toolResults : null, // --- NEW: Send tools to frontend ---
    });

  } catch (err) {
    logger.error('[ai/chat] ' + err.message, err.attempts || []);
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

router.get('/status', requireLogin, function (req, res) {
  res.json(_debugState());
});

module.exports = router;