// ============================================================
// badges/routes.js
// ============================================================
const express = require('express');
const router = express.Router();
const service = require('./service');
const { BADGES } = require('./definitions');

function requireLogin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  next();
}

/* Reusable safe SQL helper */
async function safeQuery(sql, params) {
  try {
    const db = require('../db');
    const res = await db.pool.query(sql, params);
    return res.rows || [];
  } catch (err) {
    const logger = require('../core/logger');
    logger.warn('[badges] safeQuery failed: ' + err.message);
    return [];
  }
}

/* GET /api/badges/me — user's badges, streak, and progress */
router.get('/me', requireLogin, async (req, res, next) => {
  try {
    await service.recordActivity(req.user.id, 'session');
    const awarded = await service.checkAndAward(req.user.id);
    const overview = await service.getOverview(req.user.id);
    res.json(Object.assign({}, overview, { newly_awarded: awarded }));
  } catch (err) { next(err); }
});

/* GET /api/badges/catalog */
router.get('/catalog', requireLogin, async (req, res, next) => {
  try {
    const catalog = Object.keys(BADGES).map(function (key) {
      return Object.assign({ key: key }, BADGES[key]);
    });
    res.json({ badges: catalog });
  } catch (err) { next(err); }
});

/* GET /api/badges/history — permanent completion log */
router.get('/history', requireLogin, async (req, res, next) => {
  try {
    const history = await service.getBadgeHistory(req.user.id, req.query.limit);
    res.json({ history });
  } catch (err) { next(err); }
});

/* POST /api/badges/:key/reset — reset a badge so it can be earned again */
router.post('/:key/reset', requireLogin, async (req, res, next) => {
  try {
    const result = await service.resetBadge(req.user.id, req.params.key);
    if (!result.ok) {
      const status = result.code === 'NOT_EARNED' ? 400 : 404;
      return res.status(status).json({ error: result.code });
    }
    res.json({ ok: true });
  } catch (err) { next(err); }
});

/* ============================================================
   Progress page endpoint (kept from previous work)
   ============================================================ */
router.get('/progress', requireLogin, async (req, res, next) => {
  try {
    const userId = req.user.id;

    const streakRows = await safeQuery(
      'SELECT current_streak, longest_streak, total_active_days, last_active_date FROM user_streaks WHERE user_id = $1',
      [userId]
    );
    const streak = streakRows[0] || { current_streak: 0, longest_streak: 0, total_active_days: 0 };

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
    const quizWeeks = await safeQuery(
      `SELECT to_char(date_trunc('week', created_at), 'YYYY-MM-DD') AS week_start,
              COUNT(*)::int AS count,
              AVG(score::float / NULLIF(total, 0)) * 100 AS avg_pct
         FROM quizzes
        WHERE user_id = $1 AND created_at > now() - interval '8 weeks'
        GROUP BY 1 ORDER BY 1 ASC`,
      [userId]
    );
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
    const topics = await safeQuery(
      `SELECT q.topic, COUNT(*)::int AS count
         FROM quizzes q
        WHERE q.user_id = $1 AND q.topic IS NOT NULL AND q.topic <> ''
        GROUP BY 1 ORDER BY count DESC LIMIT 10`,
      [userId]
    );
    const badgesThisMonth = await safeQuery(
      `SELECT badge_key, earned_at FROM user_badges
        WHERE user_id = $1 AND earned_at > now() - interval '30 days'
        ORDER BY earned_at DESC`,
      [userId]
    );
    const msgTotal   = await safeQuery(
      `SELECT COUNT(*)::int AS n FROM messages m
         JOIN conversations c ON c.id = m.conversation_id
        WHERE c.user_id = $1 AND m.role = 'user'`, [userId]);
    const quizTotal  = await safeQuery('SELECT COUNT(*)::int AS n FROM quizzes WHERE user_id = $1', [userId]);
    const flashTotal = await safeQuery(
      `SELECT COUNT(*)::int AS n FROM flashcard_reviews fr
         JOIN flashcards f ON f.id = fr.card_id
         JOIN flashcard_decks d ON d.id = f.deck_id
        WHERE d.user_id = $1`, [userId]);
    const noteTotal  = await safeQuery('SELECT COUNT(*)::int AS n FROM notes WHERE user_id = $1', [userId]);
    const hourDist   = await safeQuery(
      `SELECT EXTRACT(HOUR FROM m.created_at)::int AS hour, COUNT(*)::int AS count
         FROM messages m
         JOIN conversations c ON c.id = m.conversation_id
        WHERE c.user_id = $1 AND m.created_at > now() - interval '30 days'
        GROUP BY 1 ORDER BY 1`, [userId]);

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
  } catch (err) { next(err); }
});

module.exports = router;
