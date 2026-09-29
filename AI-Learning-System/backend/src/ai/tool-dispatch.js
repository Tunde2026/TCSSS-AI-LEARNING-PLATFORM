// ============================================================
// ai/tool-dispatch.js
// ------------------------------------------------------------
// Maps an AI tool_call (name + arguments) to the actual service
// that performs the work, then returns a renderable tool object
// the frontend already knows how to display.
// ============================================================

const logger = require('../core/logger');

const quizService          = require('../tools/quiz/service');
const flashcardService     = require('../tools/flashcards/service');
const theoryService        = require('../tools/theory/service');
const practiceService      = require('../tools/practice/service');
const visualizationService = require('../tools/visualization/service');
const studyPlanService     = require('../tools/studyplans/service');
const sketchService        = require('../tools/sketch/service');
const websearch            = require('../tools/websearch/service');
const imagesearch          = require('../tools/imagesearch/service');
const imagegen             = require('../tools/imagegen/service');

function clampInt(n, min, max, dflt) {
  n = parseInt(n, 10);
  if (isNaN(n)) return dflt;
  return Math.max(min, Math.min(max, n));
}
function cleanStr(s, max) {
  return String(s == null ? '' : s).trim().slice(0, max || 200);
}

async function dispatch(name, args, ctx) {
  const user = ctx && ctx.user;
  if (!user) return { ok: false, resultForAI: { error: 'no user context' } };

  try {
    switch (name) {

      case 'create_quiz': {
        const topic = cleanStr(args.topic, 200) || 'general knowledge';
        const count = clampInt(args.count, 1, 20, 10);
        const difficulty = ['easy','medium','hard'].includes(args.difficulty) ? args.difficulty : 'medium';
        const r = await quizService.generate({ userId: user.id, topic, count, difficulty });
        if (!r.ok) return { ok: false, resultForAI: { error: r.code || 'quiz_failed' } };
        return {
          ok: true,
          toolObject: {
            type: 'quiz',
            title: r.quiz.title || ('Quiz on ' + topic),
            topic,
            count: r.quiz.questions.length,
            url: '/lab/quiz.html?id=' + r.quiz.id,
          },
          resultForAI: { ok: true, quizId: r.quiz.id, questionCount: r.quiz.questions.length, topic },
        };
      }

      case 'create_flashcards': {
        const topic = cleanStr(args.topic, 200) || 'general knowledge';
        const count = clampInt(args.count, 1, 30, 10);
        const r = await flashcardService.generate({ userId: user.id, topic, count });
        if (!r.ok) return { ok: false, resultForAI: { error: r.code || 'flashcards_failed' } };
        return {
          ok: true,
          toolObject: {
            type: 'flashcards',
            title: r.deck.title || ('Flashcards on ' + topic),
            topic,
            count: r.deck.cards.length,
            url: '/lab/flashcards.html?id=' + r.deck.id,
          },
          resultForAI: { ok: true, deckId: r.deck.id, cardCount: r.deck.cards.length, topic },
        };
      }

      case 'create_theory': {
        const topic = cleanStr(args.topic, 200) || 'general knowledge';
        const count = clampInt(args.count, 1, 15, 5);
        const r = await theoryService.generate({ userId: user.id, topic, count, difficulty: 'medium' });
        if (!r.ok) return { ok: false, resultForAI: { error: r.code || 'theory_failed' } };
        return {
          ok: true,
          toolObject: {
            type: 'theory',
            title: r.set.title || ('Theory on ' + topic),
            topic,
            setId: r.set.id,
            count: r.set.questions.length,
            url: '/lab/theory.html?id=' + r.set.id,
          },
          resultForAI: { ok: true, setId: r.set.id, questionCount: r.set.questions.length, topic },
        };
      }

      case 'create_practice': {
        const topic = cleanStr(args.topic, 200) || 'general knowledge';
        const count = clampInt(args.count, 1, 15, 5);
        const difficulty = ['easy','medium','hard'].includes(args.difficulty) ? args.difficulty : 'medium';
        const r = await practiceService.generate({ userId: user.id, topic, count, difficulty });
        if (!r.ok) return { ok: false, resultForAI: { error: r.code || 'practice_failed' } };
        return {
          ok: true,
          toolObject: {
            type: 'practice',
            title: r.set.title || ('Practice: ' + topic),
            topic,
            setId: r.set.id,
            count: r.set.questions.length,
            url: '/lab/practice.html?id=' + r.set.id,
          },
          resultForAI: { ok: true, setId: r.set.id, questionCount: r.set.questions.length, topic },
        };
      }

      case 'create_study_plan': {
        const topic = cleanStr(args.topic, 200) || 'general';
        const days = clampInt(args.days, 3, 30, 7);
        const r = await studyPlanService.generate({ userId: user.id, topic, days });
        if (!r.ok) return { ok: false, resultForAI: { error: r.code || 'study_plan_failed' } };
        return {
          ok: true,
          toolObject: {
            type: 'studyplan',
            title: r.plan.title || (days + '-day plan for ' + topic),
            topic,
            planId: r.plan.id,
            days: r.plan.duration_days,
            url: '/lab/study-plans.html?id=' + r.plan.id,
          },
          resultForAI: { ok: true, planId: r.plan.id, days: r.plan.duration_days, topic },
        };
      }

      case 'create_exam': {
        const topic = cleanStr(args.topic, 200) || 'general knowledge';
        const count = clampInt(args.count, 3, 30, 10);
        const durationMin = clampInt(args.duration_minutes, 5, 120, Math.max(10, count * 2));
        const r = await quizService.generate({
          userId: user.id, topic, count, difficulty: 'medium',
          isExam: true, timeLimitSeconds: durationMin * 60,
        });
        if (!r.ok) return { ok: false, resultForAI: { error: r.code || 'exam_failed' } };
        return {
          ok: true,
          toolObject: {
            type: 'exam',
            title: r.quiz.title || ('Exam: ' + topic),
            topic,
            examId: r.quiz.id,
            count: r.quiz.questions.length,
            duration_minutes: durationMin,
            url: '/lab/exam.html?id=' + r.quiz.id,
          },
          resultForAI: { ok: true, examId: r.quiz.id, questionCount: r.quiz.questions.length, durationMinutes: durationMin, topic },
        };
      }

      case 'create_visualization': {
        const topic = cleanStr(args.topic, 200) || 'general';
        const kind = args.kind || null;
        const r = await visualizationService.generate({ topic, kind });
        if (!r.ok) return { ok: false, resultForAI: { error: r.code || 'viz_failed' } };
        return {
          ok: true,
          toolObject: {
            type: 'visualization',
            title: r.visualization.title || ('Diagram: ' + topic),
            topic,
            kind: r.visualization.kind,
            mermaid: r.visualization.mermaid,
            explanation: r.visualization.explanation,
            url: '/lab/visualization.html',
          },
          resultForAI: { ok: true, topic, kind: r.visualization.kind },
        };
      }

      case 'create_sketch': {
        const query = cleanStr(args.query, 300);
        if (!query) return { ok: false, resultForAI: { error: 'query required' } };
        const r = await sketchService.generateFormula({ query });
        if (!r.ok) return { ok: false, resultForAI: { error: r.code || 'sketch_failed' } };
        return {
          ok: true,
          toolObject: {
            type: 'sketch',
            title: 'Sketch: ' + query,
            topic: query,
            kind: r.result.kind,
            plain: r.result.plain,
            unicode: r.result.unicode,
            latex: r.result.latex,
            explanation: r.result.explanation,
            url: '/lab/sketch.html',
          },
          resultForAI: { ok: true, query, unicode: r.result.unicode, latex: r.result.latex },
        };
      }

      case 'web_search': {
        const query = cleanStr(args.query, 300);
        if (!query) return { ok: false, resultForAI: { error: 'query required' } };
        if (!websearch.isEnabled || !websearch.isEnabled()) {
          return { ok: false, resultForAI: { error: 'web_search_unavailable' } };
        }
        const r = await websearch.search(query, { count: 5 });
        if (!r.ok || !r.results.length) return { ok: false, resultForAI: { error: 'no_results' } };
        const sources = r.results.slice(0, 5).map(function (x) {
          return { title: x.title, url: x.url, snippet: (x.description || '').slice(0, 200) };
        });
        return {
          ok: true,
          toolObject: { type: 'websearch', sources },
          resultForAI: { ok: true, sources },
        };
      }

      case 'search_images': {
        const query = cleanStr(args.query, 200);
        if (!query) return { ok: false, resultForAI: { error: 'query required' } };
        if (!imagesearch.isEnabled || !imagesearch.isEnabled()) {
          return { ok: false, resultForAI: { error: 'image_search_unavailable' } };
        }
        const count = clampInt(args.count, 1, 12, 6);
        const r = await imagesearch.search(query, { count });
        if (!r.ok || !r.images.length) return { ok: false, resultForAI: { error: 'no_results' } };
        return {
          ok: true,
          toolObject: {
            type: 'photos',
            title: 'Photos: ' + query,
            query,
            images: r.images.map(function (img) {
              return { url: img.url, thumb: img.thumb, author: img.author, sourceUrl: img.sourceUrl, alt: img.alt };
            }),
          },
          resultForAI: { ok: true, imageCount: r.images.length, query },
        };
      }

      case 'generate_image': {
        const prompt = cleanStr(args.prompt, 400);
        if (!prompt) return { ok: false, resultForAI: { error: 'prompt required' } };
        const r = await imagegen.generate({ prompt, model: 'flux', width: 1024, height: 1024 });
        if (!r.ok) return { ok: false, resultForAI: { error: r.code || 'image_gen_failed' } };
        return {
          ok: true,
          toolObject: { type: 'image', url: r.image.url, prompt, source: 'pollinations', title: prompt },
          resultForAI: { ok: true, prompt, imageUrl: r.image.url },
        };
      }

      case 'save_note': {
        const title = cleanStr(args.title, 200);
        const content = cleanStr(args.content, 8000);
        const subject = args.subject ? cleanStr(args.subject, 80) : null;
        if (!title || !content) return { ok: false, resultForAI: { error: 'title and content required' } };
        try {
          const db = require('../db');
          if (db.notes && typeof db.notes.create === 'function') {
            const note = await db.notes.create({ userId: user.id, title, content, subject });
            return {
              ok: true,
              toolObject: { type: 'notes', title, topic: subject || 'general', noteId: note && note.id, url: '/lab/notes.html' },
              resultForAI: { ok: true, noteId: note && note.id, title },
            };
          }
        } catch (err) {
          logger.warn('[tool-dispatch] save_note failed: ' + err.message);
        }
        return {
          ok: true,
          toolObject: { type: 'notes', title, topic: subject || 'general', url: '/lab/notes.html' },
          resultForAI: { ok: true, title, saved: false },
        };
      }

      case 'get_mistakes':
        return {
          ok: true,
          toolObject: { type: 'mistakes', title: 'Mistake Bank' },
          resultForAI: { ok: true },
        };

      default:
        return { ok: false, resultForAI: { error: 'unknown_tool: ' + name } };
    }
  } catch (err) {
    logger.warn('[tool-dispatch] ' + name + ' threw: ' + err.message);
    return { ok: false, resultForAI: { error: 'tool_error: ' + err.message } };
  }
}

module.exports = { dispatch };
