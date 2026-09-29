const express = require('express');
const router = express.Router();
const service = require('./service');

// Safe query: never throws, returns [] on any error
async function safeQuery(sql, params) {
  try {
    const db = require('../db');
    const res = await db.pool.query(sql, params);
    return res.rows || [];
  } catch (err) {
    const logger = require('../core/logger');
    logger.warn('[badges/progress] safeQuery failed: ' + err.message);
    return [];
  }
}
const { BADGES } = require('./definitions');

function requireLogin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  next();
}

router.get('/me', requireLogin, async (req, res, next) => {
  try {
    // Record today's activity (idempotent) and check for new badges
    await service.recordActivity(req.user.id, 'session');
    const awarded = await service.checkAndAward(req.user.id);
    const overview = await service.getOverview(req.user.id);
    res.json(Object.assign({}, overview, { newly_awarded: awarded }));
  } catch (err) { next(err); }
});

router.get('/catalog', requireLogin, async (req, res, next) => {
  try {
    const catalog = Object.keys(BADGES).map(function (key) {
      return Object.assign({ key: key }, BADGES[key]);
    });
    res.json({ badges: catalog });
  } catch (err) { next(err); }
});


router.get('/progress', requireLogin, async (req, res, next) => {
  try {
    const userId = req.user.id;

    // ---- Streak ----
    const streakRows = await safeQuery(
      'SELECT current_streak, longest_streak, total_active_days, last_active_date FROM user_streaks WHERE user_id = $1',
      [userId]
    );
    const streak = streakRows[0] || { current_streak: 0, longest_streak: 0, total_active_days: 0 };

    // ---- Weekly message activity ----
    const messageWeeks = await safeQuery(
      `SELECT to_char(date_trunc('week', m.created_at), 'YYYY-MM-DD') AS week_start,
              COUNT(*)::int AS count
         FROM messages m
         JOIN conversations c ON c.id = m.conversation_id
        WHERE c.user_id = $1 AND m.role = 'user'
          AND m.created_at > now() - interval '8 weeks'
        GROUP BY 1 ORDER BY 1 ASC`,
      [userId]
    );

    // ---- Weekly quizzes ----
    const quizWeeks = await safeQuery(
      `SELECT to_char(date_trunc('week', created_at), 'YYYY-MM-DD') AS week_start,
              COUNT(*)::int AS count,
              AVG(score::float / NULLIF(total, 0)) * 100 AS avg_pct
         FROM quizzes
        WHERE user_id = $1 AND created_at > now() - interval '8 weeks'
        GROUP BY 1 ORDER BY 1 ASC`,
      [userId]
    );

    // ---- Weekly flashcards ----
    const flashWeeks = await safeQuery(
      `SELECT to_char(date_trunc('week', fr.reviewed_at), 'YYYY-MM-DD') AS week_start,
              COUNT(*)::int AS count
         FROM flashcard_reviews fr
         JOIN flashcards f ON f.id = fr.card_id
         JOIN flashcard_decks d ON d.id = f.deck_id
        WHERE d.user_id = $1 AND fr.reviewed_at > now() - interval '8 weeks'
        GROUP BY 1 ORDER BY 1 ASC`,
      [userId]
    );

    // ---- Topics ----
    const topics = await safeQuery(
      `SELECT q.topic, COUNT(*)::int AS count
         FROM quizzes q
        WHERE q.user_id = $1 AND q.topic IS NOT NULL AND q.topic <> ''
        GROUP BY 1 ORDER BY count DESC LIMIT 10`,
      [userId]
    );

    // ---- Badges this month ----
    const badgesThisMonth = await safeQuery(
      `SELECT badge_key, earned_at FROM user_badges
        WHERE user_id = $1 AND earned_at > now() - interval '30 days'
        ORDER BY earned_at DESC`,
      [userId]
    );

    // ---- All-time totals ----
    const msgTotal     = await safeQuery(
      `SELECT COUNT(*)::int AS n FROM messages m
         JOIN conversations c ON c.id = m.conversation_id
        WHERE c.user_id = $1 AND m.role = 'user'`, [userId]);
    const quizTotal    = await safeQuery('SELECT COUNT(*)::int AS n FROM quizzes WHERE user_id = $1', [userId]);
    const flashTotal   = await safeQuery(
      `SELECT COUNT(*)::int AS n FROM flashcard_reviews fr
         JOIN flashcards f ON f.id = fr.card_id
         JOIN flashcard_decks d ON d.id = f.deck_id
        WHERE d.user_id = $1`, [userId]);
    const noteTotal    = await safeQuery('SELECT COUNT(*)::int AS n FROM notes WHERE user_id = $1', [userId]);

    // ---- Hour distribution ----
    const hourDist = await safeQuery(
      `SELECT EXTRACT(HOUR FROM m.created_at)::int AS hour, COUNT(*)::int AS count
         FROM messages m
         JOIN conversations c ON c.id = m.conversation_id
        WHERE c.user_id = $1 AND m.created_at > now() - interval '30 days'
        GROUP BY 1 ORDER BY 1`, [userId]);

    // ---- Build 8-week timeline ----
    const weeks = [];
    const now = new Date();
    const day = now.getDay();
    const diffToMonday = (day + 6) % 7;
    const thisMonday = new Date(now);
    thisMonday.setHours(0, 0, 0, 0);
    thisMonday.setDate(thisMonday.getDate() - diffToMonday);

    for (let i = 7; i >= 0; i--) {
      const wk = new Date(thisMonday);
      wk.setDate(wk.getDate() - i * 7);
      const key = wk.toISOString().slice(0, 10);
      const m = messageWeeks.find(function (x) { return x.week_start.slice(0, 10) === key; });
      const q = quizWeeks.find(function (x) { return x.week_start.slice(0, 10) === key; });
      const f = flashWeeks.find(function (x) { return x.week_start.slice(0, 10) === key; });
      weeks.push({
        weekStart: key,
        messages: m ? m.count : 0,
        quizzes: q ? q.count : 0,
        avgQuizPct: q && q.avg_pct != null ? Math.round(q.avg_pct) : null,
        flashcards: f ? f.count : 0,
      });
    }

    res.json({
      streak: streak,
      weeks: weeks,
      topics: topics,
      badgesThisMonth: badgesThisMonth,
      totals: {
        messages: msgTotal[0] ? msgTotal[0].n : 0,
        quizzes: quizTotal[0] ? quizTotal[0].n : 0,
        flashcards: flashTotal[0] ? flashTotal[0].n : 0,
        notes: noteTotal[0] ? noteTotal[0].n : 0,
      },
      hourDist: hourDist,
    });
  } catch (err) {
    const logger = require('../core/logger');
    logger.error('[badges/progress] fatal: ' + err.message);
    next(err);
  }
});

module.exports = router;
