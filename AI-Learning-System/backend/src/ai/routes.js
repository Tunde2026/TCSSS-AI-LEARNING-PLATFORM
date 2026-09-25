// ============================================================
// ai/routes.js
// ============================================================

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
const quizService = require('../tools/quiz/service');
const flashcardService = require('../tools/flashcards/service');
const practiceService = require('../tools/practice/service');
const visualizationService = require('../tools/visualization/service');
const studyPlanService = require('../tools/studyplans/service');
const theoryService = require('../tools/theory/service');
const sketchService = require('../tools/sketch/service');

function detectQuizIntent(t) {
  return /(?:create|make|generate|give me|start|prepare|set up|build)\s+(?:a\s+|an\s+)?(?:quiz|test|assessment|questions?)/i.test(t) ||
         /(?:quiz|test)\s+(?:me|on|about|for|covering)/i.test(t) ||
         /(?:ask me|test me)\s+(?:some\s+)?questions/i.test(t);
}

function detectFlashcardsIntent(t) {
  return /(?:create|make|generate|give me|build)\s+(?:some\s+|a\s+)?flashcards?/i.test(t) ||
         /flashcards?\s+(?:for|on|about|covering)/i.test(t);
}

function detectNotesIntent(t) {
  return /(?:create|make|save|write|add)\s+(?:me\s+)?(?:a\s+)?note/i.test(t) ||
         /save\s+(?:this|that|it)\s+to\s+(?:my\s+)?notes/i.test(t) ||
         /add\s+(?:this|that|it)\s+to\s+(?:my\s+)?notes/i.test(t);
}

function detectPracticeIntent(t) {
  return /(?:create|make|generate|give me|build)\s+(?:some\s+|a\s+)?practice/i.test(t) ||
         /practice\s+(?:questions?|problems?|set)/i.test(t);
}

function detectTheoryIntent(t) {
  return /(?:create|make|generate|give me|build)\s+(?:some\s+|a\s+)?(?:theory|fill[- ]in[- ]the[- ]gap|fill[- ]in[- ]the[- ]blank)/i.test(t) ||
         /(?:theory|fill[- ]in[- ]the[- ]gap)\s+(?:questions?|quiz|test)\s+(?:on|about|for|covering)/i.test(t) ||
         /gap[- ]fill\s+(?:questions?|test)/i.test(t);
}

function detectVisualizationIntent(t) {
  return /(?:draw|visualize|visualise|make a diagram|create a diagram|show me a diagram|explain with a diagram)/i.test(t) ||
         /(?:diagram|flowchart|mind ?map)\s+(?:of|for|showing|about)/i.test(t);
}

function detectStudyPlanIntent(t) {
  return /(?:create|make|build|plan)\s+(?:me\s+)?(?:a\s+)?study\s+(?:plan|schedule|timetable)/i.test(t) ||
         /study\s+(?:plan|schedule)\s+(?:for|on|about)/i.test(t);
}

function detectExamIntent(t) {
  return /(?:exam|timed)\s+mode/i.test(t) ||
         /(?:give me|start|begin|take)\s+(?:an?\s+)?(?:timed\s+)?exam/i.test(t) ||
         /test me under exam conditions/i.test(t);
}

function detectMistakesIntent(t) {
  return /(?:my|show me my|view my|open my)\s+mistakes?/i.test(t) ||
         /mistake\s+bank/i.test(t) ||
         /what (?:have|did)\s+i\s+(?:got|gotten)\s+wrong/i.test(t);
}

function detectSketchIntent(t) {
  return /(?:help me\s+)?(?:write|type|enter|compose|format)\s+(?:the\s+)?(?:formula|equation|chemical|structure)/i.test(t) ||
         /(?:sketch|formula\s+(?:studio|editor|composer))/i.test(t) ||
         /how do i (?:write|type|format)\s+(?:h2so4|co2|ca\(oh\)2|[a-z]+\d+)/i.test(t);
}

function detectImageGenerateIntent(t) {
  const verbs = ['draw', 'generate image', 'generate an image', 'create image',
                 'create an image', 'make an image', 'make a picture',
                 'illustrate', 'picture of', 'image of', 'render'];
  const nouns = ['image', 'picture', 'illustration', 'drawing', 'artwork'];
  return verbs.some(function (v) { return t.indexOf(v) !== -1; }) &&
         nouns.some(function (n) { return t.indexOf(n) !== -1; });
}

function detectPhotoSearchIntent(t) {
  const phrases = ['show me a photo', 'show me photos', 'find a photo', 'find photos',
                   'real photo', 'real picture', 'actual photo', 'actual picture',
                   'photos of', 'pictures of', 'real images of'];
  return phrases.some(function (p) { return t.indexOf(p) !== -1; });
}

function detectWebSearchIntent(t) {
  const triggers = [
    'latest', 'current', 'today', 'this year', 'this week',
    'recent', 'news', '2025', '2026', '2027',
    'right now', 'up to date', 'update on',
  ];
  return triggers.some(function (k) { return t.indexOf(k) !== -1; });
}

function extractTopic(text) {
  return String(text || '')
    .replace(/^(please\s+)?(?:can you\s+)?(?:create|make|generate|give me|start|prepare|set up|build|i need you to|ask me)\s+(?:a\s+|an\s+|some\s+)?/i, '')
    .replace(/\b(?:quiz|test|exam|assessment|flashcards?|questions?|practice|problems?|diagram|flowchart|mind ?map|image|picture|illustration|drawing|artwork|notes?|study\s+plan|study\s+schedule|formula|equation|theory|fill[- ]in[- ]the[- ]gap)\b\s*(?:me|on|about|for|covering|of|showing|with)?\s*/gi, '')
    .replace(/[?.!]+$/, '')
    .trim() || 'general knowledge';
}

function extractNumber(text, fallback) {
  const m = String(text).match(/\b(\d{1,3})\b/);
  if (!m) return fallback;
  const n = parseInt(m[1], 10);
  if (Number.isNaN(n) || n < 1) return fallback;
  return Math.min(n, 50);
}

async function runToolDetection({ user, userText }) {
  const t = String(userText || '').toLowerCase();
  const tools = [];
  const injectedContext = [];

  if (detectQuizIntent(t)) {
    const topic = extractTopic(userText);
    const count = extractNumber(userText, 10);
    try {
      const result = await quizService.generate({ userId: user.id, topic: topic, count: count, difficulty: 'medium' });
      if (result.ok) {
        tools.push({
          type: 'quiz',
          title: result.quiz.title || ('Quiz on ' + topic),
          topic: topic,
          count: result.quiz.questions.length,
          url: '/lab/quiz.html?id=' + result.quiz.id,
        });
        injectedContext.push('A quiz on "' + topic + '" with ' + result.quiz.questions.length + ' questions has been created. It appears as a clickable card below. Mention it in one short sentence and let the student click to start.');
      } else {
        logger.warn('[ai/chat] quiz tool failed: ' + result.code);
      }
    } catch (err) { logger.warn('[ai/chat] quiz tool threw: ' + err.message); }
  }
  else if (detectFlashcardsIntent(t)) {
    const topic = extractTopic(userText);
    const count = extractNumber(userText, 10);
    try {
      const result = await flashcardService.generate({ userId: user.id, topic: topic, count: count });
      if (result.ok) {
        tools.push({
          type: 'flashcards',
          title: result.deck.title || ('Flashcards on ' + topic),
          topic: topic,
          count: result.deck.cards.length,
          url: '/lab/flashcards.html?id=' + result.deck.id,
        });
        injectedContext.push('A flashcard deck on "' + topic + '" with ' + result.deck.cards.length + ' cards has been created. It appears as a clickable card below. Mention it briefly so the student knows to click it.');
      }
    } catch (err) { logger.warn('[ai/chat] flashcards tool threw: ' + err.message); }
  }
  else if (detectNotesIntent(t)) {
    tools.push({
      type: 'notes',
      title: 'Notes',
      topic: extractTopic(userText),
      url: '/lab/notes.html',
    });
    injectedContext.push('The Notes tool can be opened from the card below. Tell the student briefly that they can create and save notes there.');
  }
  else if (detectPracticeIntent(t)) {
    const topic = extractTopic(userText);
    const count = extractNumber(userText, 5);
    try {
      const result = await practiceService.generate({ userId: user.id, topic: topic, count: count, difficulty: 'medium' });
      if (result.ok) {
        tools.push({
          type: 'practice',
          title: result.set.title || ('Practice: ' + topic),
          topic: topic,
          setId: result.set.id,
          count: result.set.questions.length,
          url: '/lab/practice.html?id=' + result.set.id,
        });
        injectedContext.push('A practice set on "' + topic + '" with ' + result.set.questions.length + ' questions has been created. It appears as an interactive widget below. Introduce the topic in one sentence.');
      } else {
        logger.warn('[ai/chat] practice tool failed: ' + result.code);
      }
    } catch (err) { logger.warn('[ai/chat] practice tool threw: ' + err.message); }
  }
  else if (detectTheoryIntent(t)) {
    const topic = extractTopic(userText);
    const count = extractNumber(userText, 5);
    try {
      const result = await theoryService.generate({
        userId: user.id,
        topic: topic,
        count: count,
        difficulty: 'medium',
      });
      if (result.ok) {
        tools.push({
          type: 'theory',
          title: result.set.title || ('Theory on ' + topic),
          topic: topic,
          setId: result.set.id,
          count: result.set.questions.length,
          url: '/lab/theory.html?id=' + result.set.id,
        });
        injectedContext.push(
          'A fill-in-the-gap theory set on "' + topic + '" with ' + result.set.questions.length +
          ' questions has been created. It renders as an interactive widget below. ' +
          'Introduce it in one short sentence and let the student fill in the blanks.'
        );
      } else {
        logger.warn('[ai/chat] theory tool failed: ' + result.code);
      }
    } catch (err) { logger.warn('[ai/chat] theory tool threw: ' + err.message); }
  }
  else if (detectVisualizationIntent(t)) {
    const topic = extractTopic(userText);
    try {
      const result = await visualizationService.generate({ topic: topic, kind: null });
      if (result.ok) {
        tools.push({
          type: 'visualization',
          title: result.visualization.title || ('Diagram: ' + topic),
          topic: topic,
          kind: result.visualization.kind,
          mermaid: result.visualization.mermaid,
          explanation: result.visualization.explanation,
          url: '/lab/visualization.html',
        });
        injectedContext.push('A diagram for "' + topic + '" has been created. It appears as an interactive widget below. Introduce the topic in one or two sentences.');
      } else {
        logger.warn('[ai/chat] visualization tool failed: ' + result.code);
      }
    } catch (err) { logger.warn('[ai/chat] visualization tool threw: ' + err.message); }
  }
  else if (detectStudyPlanIntent(t)) {
    const topic = extractTopic(userText);
    const days = Math.max(3, Math.min(30, extractNumber(userText, 7)));
    try {
      const result = await studyPlanService.generate({ userId: user.id, topic: topic, days: days });
      if (result.ok) {
        tools.push({
          type: 'studyplan',
          title: result.plan.title || (days + '-day plan for ' + topic),
          topic: topic,
          planId: result.plan.id,
          days: result.plan.duration_days,
          url: '/lab/study-plans.html?id=' + result.plan.id,
        });
        injectedContext.push('A ' + days + '-day study plan for "' + topic + '" has been created. It appears as an interactive widget below with checkboxes. Introduce it in one sentence.');
      } else {
        logger.warn('[ai/chat] study plan tool failed: ' + result.code);
      }
    } catch (err) { logger.warn('[ai/chat] study plan tool threw: ' + err.message); }
  }
  else if (detectExamIntent(t)) {
    const topic = extractTopic(userText);
    const count = extractNumber(userText, 10);
    try {
      const result = await quizService.generate({
        userId: user.id,
        topic: topic,
        count: count,
        difficulty: 'medium',
        isExam: true,
        timeLimitSeconds: Math.max(300, count * 90),
      });
      if (result.ok) {
        tools.push({
          type: 'exam',
          title: result.quiz.title || ('Exam: ' + topic),
          topic: topic,
          examId: result.quiz.id,
          count: result.quiz.questions.length,
          duration_minutes: Math.round((result.quiz.time_limit_seconds || count * 90) / 60),
          url: '/lab/exam.html?id=' + result.quiz.id,
        });
        injectedContext.push(
          'A timed exam on "' + topic + '" with ' + result.quiz.questions.length + ' questions has been created. ' +
          'It appears as an interactive timed widget below. Explain briefly that it has a countdown and no hints.'
        );
      } else {
        logger.warn('[ai/chat] exam tool failed: ' + result.code);
      }
    } catch (err) { logger.warn('[ai/chat] exam tool threw: ' + err.message); }
  }
  else if (detectMistakesIntent(t)) {
    tools.push({ type: 'mistakes', title: 'My Mistakes', url: '/lab/mistakes.html' });
    injectedContext.push('The student\'s Mistake Bank can be opened from the card below. Mention briefly that it shows their weak topics.');
  }
  else if (detectSketchIntent(t)) {
    const cleanQuery = String(userText)
      .replace(/^(?:please\s+)?(?:can you\s+)?(?:help me\s+)?(?:write|type|enter|compose|format)\s+(?:the\s+)?/i, '')
      .replace(/\s+(?:correctly|properly|as a formula|in a formula|for me)\.?$/i, '')
      .trim();
    const query = cleanQuery || extractTopic(userText);
    try {
      const result = await sketchService.generateFormula({ query: query });
      if (result.ok) {
        tools.push({
          type: 'sketch',
          title: 'Sketch: ' + query,
          topic: query,
          kind: result.result.kind,
          plain: result.result.plain,
          unicode: result.result.unicode,
          latex: result.result.latex,
          explanation: result.result.explanation,
          url: '/lab/sketch.html',
        });
        injectedContext.push(
          'A formula for "' + query + '" has been prepared in the Sketch widget below. ' +
          'Explain in one short sentence and let the student use the widget.'
        );
      } else {
        logger.warn('[ai/chat] sketch tool failed: ' + result.code);
      }
    } catch (err) { logger.warn('[ai/chat] sketch tool threw: ' + err.message); }
  }
  else if (detectImageGenerateIntent(t)) {
    const prompt = extractTopic(userText);
    try {
      const r = await imagegen.generate({ prompt: prompt, model: 'flux', width: 1024, height: 1024 });
      if (r.ok) {
        tools.push({ type: 'image', url: r.image.url, prompt: prompt, source: 'pollinations', title: prompt });
        injectedContext.push('An image for "' + prompt + '" has been generated and appears below. Introduce it in one sentence.');
      }
    } catch (err) { logger.warn('[ai/chat] imagegen threw: ' + err.message); }
  }
  else if (detectPhotoSearchIntent(t) && imagesearch.isEnabled()) {
    const query = extractTopic(userText);
    try {
      const r = await imagesearch.search(query, { count: 6 });
      if (r.ok && r.images.length) {
        tools.push({
          type: 'photos',
          title: 'Photos: ' + query,
          query: query,
          images: r.images.map(function (img) {
            return { url: img.url, thumb: img.thumb, author: img.author, sourceUrl: img.sourceUrl, alt: img.alt };
          }),
        });
        injectedContext.push('Real photos for "' + query + '" have been found and appear below. Introduce them in one sentence.');
      }
    } catch (err) { logger.warn('[ai/chat] imagesearch threw: ' + err.message); }
  }

  if (detectWebSearchIntent(t) && websearch.isEnabled() && tools.length === 0) {
    try {
      const r = await websearch.search(userText, { count: 5 });
      if (r.ok && r.results.length) {
        const sources = r.results.slice(0, 5).map(function (x) {
          return { title: x.title, url: x.url, snippet: (x.description || '').slice(0, 200) };
        });
        tools.push({ type: 'websearch', sources: sources });
        injectedContext.push(websearch.buildContextBlock(userText, r.results));
      }
    } catch (err) { logger.warn('[ai/chat] websearch threw: ' + err.message); }
  }

  return { tools: tools, injectedContext: injectedContext };
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

    const decision = await route({ user: req.user, messages: messages, agentId: agentId || null });

    const toolResult = await runToolDetection({ user: req.user, userText: lastUser.content });

    let gatewayMessages = messages.slice();
    const injectedSystemBlocks = [];

    if (decision.agent && decision.agent.system_prompt) {
      injectedSystemBlocks.push(decision.agent.system_prompt);
    }

    if (Array.isArray(attachmentIds) && attachmentIds.length) {
      try {
        const attCtx = await attachments.buildContextFor(attachmentIds, req.user.id);
        if (attCtx) injectedSystemBlocks.push(attCtx);
      } catch (err) { logger.warn('[ai/chat] attachment context failed: ' + err.message); }
    }

    try {
      const rc = await retrieval.retrieveContext(lastUser.content);
      if (rc.contextText) injectedSystemBlocks.push(rc.contextText);
    } catch (err) { logger.warn('[ai/chat] retrieval failed: ' + err.message); }

    toolResult.injectedContext.forEach(function (block) { injectedSystemBlocks.push(block); });

    if (injectedSystemBlocks.length) {
      const combined = injectedSystemBlocks.join('\n\n=====\n\n');
      gatewayMessages = [{ role: 'system', content: combined }].concat(gatewayMessages);
    }

    const result = await chat({ messages: gatewayMessages });

    const renderableTools = toolResult.tools.filter(function (t) {
      return t.type !== 'websearch' && t.type !== 'image' && t.type !== 'photos';
    });
    const inlineImages = toolResult.tools.filter(function (t) { return t.type === 'image'; })
      .map(function (t) { return { url: t.url, prompt: t.prompt, source: t.source }; });
    const photoResults = toolResult.tools.filter(function (t) { return t.type === 'photos'; });
    const webSearchTool = toolResult.tools.find(function (t) { return t.type === 'websearch'; });

    const responseTools = [];
    renderableTools.forEach(function (t) { responseTools.push(t); });
    photoResults.forEach(function (t) {
      (t.images || []).forEach(function (img) {
        responseTools.push({ type: 'image', url: img.url, thumb: img.thumb, source: 'pexels', author: img.author, sourceUrl: img.sourceUrl, alt: img.alt });
      });
    });
    inlineImages.forEach(function (t) {
      responseTools.push({ type: 'image', url: t.url, source: t.source || 'pollinations', alt: t.prompt });
    });

    var media = null;
    if (responseTools.length || webSearchTool) {
      media = {};
      if (responseTools.length) media.tools = responseTools;
      if (webSearchTool) media.webSearch = { sources: webSearchTool.sources };
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
      libraryUsed: false,
      webSearch: webSearchTool ? { sources: webSearchTool.sources } : null,
      tools: responseTools.length ? responseTools : null,
    });
  } catch (err) {
    logger.error('[ai/chat] ' + err.message, err.attempts || []);
    if (err.message === 'REQUEST_REJECTED') return res.status(400).json({ error: 'The request was rejected by the model.' });
    if (err.message === 'NO_PROVIDERS_AVAILABLE') return res.status(503).json({ error: 'No AI providers are configured.' });
    if (err.message === 'ALL_PROVIDERS_FAILED') return res.status(503).json({ error: 'AI temporarily unavailable. Please try again.' });
    next(err);
  }
});

router.post('/quick', requireLogin, async (req, res, next) => {
  const { messages, context } = req.body || {};
  const quick = require('./quick');
  if (!Array.isArray(messages) || !messages.length) return res.status(400).json({ error: 'messages required' });
  const result = await quick.quickAsk({ user: req.user, messages: messages, context: context || null });
  if (!result.ok) {
    if (result.code === 'ALL_PROVIDERS_FAILED' || result.code === 'NO_PROVIDERS_AVAILABLE') {
      return res.status(503).json({ error: 'AI temporarily unavailable.' });
    }
    return res.status(500).json({ error: 'Unexpected AI error.' });
  }
  res.json({ reply: result.text, provider: result.provider });
});

router.get('/status', requireLogin, function (req, res) { res.json(_debugState()); });

module.exports = router;