// ============================================================
// badges/service.js
// ============================================================
const db = require('../db');
const logger = require('../core/logger');
const { BADGES } = require('./definitions');

/**
 * Record that the user was active today.
 * Safe to call multiple times per day — it only advances once.
 */
async function recordActivity(userId, type) {
  if (!userId) return;
  const today = new Date().toISOString().slice(0, 10);
  try {
    await db.pool.query(
      `INSERT INTO user_activity_log (user_id, activity_date, activity_type)
       VALUES ($1, $2, $3)`,
      [userId, today, type || 'session']
    );

    await db.pool.query(
      `INSERT INTO user_streaks (user_id, current_streak, longest_streak, total_active_days, last_active_date)
       VALUES ($1, 1, 1, 1, $2)
       ON CONFLICT (user_id) DO UPDATE
       SET current_streak = CASE
             WHEN user_streaks.last_active_date = $2 THEN user_streaks.current_streak
             WHEN user_streaks.last_active_date = $2::date - INTERVAL '1 day'
               THEN user_streaks.current_streak + 1
             ELSE 1
           END,
           longest_streak = GREATEST(
             user_streaks.longest_streak,
             CASE
               WHEN user_streaks.last_active_date = $2 THEN user_streaks.current_streak
               WHEN user_streaks.last_active_date = $2::date - INTERVAL '1 day'
                 THEN user_streaks.current_streak + 1
               ELSE 1
             END
           ),
           total_active_days = CASE
             WHEN user_streaks.last_active_date = $2 THEN user_streaks.total_active_days
             ELSE user_streaks.total_active_days + 1
           END,
           last_active_date = $2,
           updated_at = now()`,
      [userId, today]
    );
  } catch (err) {
    logger.warn('[badges] recordActivity failed: ' + err.message);
  }
}

/** Award a badge. Returns true if newly granted. */
async function award(userId, badgeKey, metadata) {
  try {
    const r = await db.pool.query(
      `INSERT INTO user_badges (user_id, badge_key, metadata)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, badge_key) DO NOTHING
       RETURNING id`,
      [userId, badgeKey, metadata || {}]
    );
    return r.rowCount > 0;
  } catch (_) { return false; }
}

/** Look at the user's history and award any badges they've earned. */
async function checkAndAward(userId) {
  const awarded = [];
  try {
    // ---- Streak badges ----
    const streakRow = (await db.pool.query(
      `SELECT current_streak FROM user_streaks WHERE user_id = $1`, [userId]
    )).rows[0];
    if (streakRow) {
      const s = streakRow.current_streak || 0;
      if (s >= 3)  { if (await award(userId, 'streak_3'))  awarded.push('streak_3'); }
      if (s >= 7)  { if (await award(userId, 'streak_7'))  awarded.push('streak_7'); }
      if (s >= 30) { if (await award(userId, 'streak_30')) awarded.push('streak_30'); }
    }

    // ---- Chat badges ----
    const chatRes = await db.pool.query(
      `SELECT COUNT(*)::int AS n FROM messages m
         JOIN conversations c ON c.id = m.conversation_id
        WHERE c.user_id = $1 AND m.role = 'user'`,
      [userId]
    ).catch(() => ({ rows: [{ n: 0 }] }));
    const chatCount = chatRes.rows[0].n || 0;
    if (chatCount >= 1)   { if (await award(userId, 'first_chat'))       awarded.push('first_chat'); }
    if (chatCount >= 100) { if (await award(userId, 'knowledge_seeker')) awarded.push('knowledge_seeker'); }

    // ---- Quiz badges ----
    const quizRes = await db.pool.query(
      `SELECT COUNT(*)::int AS n FROM quizzes WHERE user_id = $1`, [userId]
    ).catch(() => ({ rows: [{ n: 0 }] }));
    const quizCount = quizRes.rows[0].n || 0;
    if (quizCount >= 1)  { if (await award(userId, 'first_quiz')) awarded.push('first_quiz'); }
    if (quizCount >= 10) { if (await award(userId, 'quiz_10'))    awarded.push('quiz_10'); }
    if (quizCount >= 50) { if (await award(userId, 'quiz_50'))    awarded.push('quiz_50'); }

    // ---- Flashcards ----
    const fcRes = await db.pool.query(
      `SELECT COUNT(*)::int AS n FROM flashcard_reviews fr
         JOIN flashcards f ON f.id = fr.card_id
         JOIN flashcard_decks d ON d.id = f.deck_id
        WHERE d.user_id = $1`, [userId]
    ).catch(() => ({ rows: [{ n: 0 }] }));
    const fcCount = fcRes.rows[0].n || 0;
    if (fcCount >= 1)   { if (await award(userId, 'first_flashcard')) awarded.push('first_flashcard'); }
    if (fcCount >= 100) { if (await award(userId, 'flashcard_100'))   awarded.push('flashcard_100'); }

    // ---- Theory ----
    const thRes = await db.pool.query(
      `SELECT COUNT(*)::int AS n FROM theory_attempts WHERE user_id = $1`, [userId]
    ).catch(() => ({ rows: [{ n: 0 }] }));
    if ((thRes.rows[0].n || 0) >= 1) {
      if (await award(userId, 'first_theory')) awarded.push('first_theory');
    }

    // ---- Notes ----
    const nRes = await db.pool.query(
      `SELECT COUNT(*)::int AS n FROM notes WHERE user_id = $1`, [userId]
    ).catch(() => ({ rows: [{ n: 0 }] }));
    if ((nRes.rows[0].n || 0) >= 1) {
      if (await award(userId, 'first_note')) awarded.push('first_note');
    }

    // ---- Time of day ----
    const hour = new Date().getHours();
    if (hour < 7)  { if (await award(userId, 'early_bird')) awarded.push('early_bird'); }
    if (hour >= 22) { if (await award(userId, 'night_owl')) awarded.push('night_owl'); }

    // ---- Verified flag ----
    const userRow = (await db.pool.query(
      `SELECT verified FROM users WHERE id = $1`, [userId]
    )).rows[0];
    if (userRow && userRow.verified) {
      if (await award(userId, 'verified')) awarded.push('verified');
    }
  } catch (err) {
    logger.warn('[badges] checkAndAward failed: ' + err.message);
  }
  return awarded;
}

async function getUserBadges(userId) {
  const r = await db.pool.query(
    `SELECT badge_key, earned_at, metadata FROM user_badges
      WHERE user_id = $1 ORDER BY earned_at DESC`,
    [userId]
  );
  return r.rows.map(function (row) {
    const def = BADGES[row.badge_key] || { name: row.badge_key, desc: '', icon: 'fa-medal', color: 'navy' };
    return {
      key: row.badge_key,
      name: def.name,
      desc: def.desc,
      icon: def.icon,
      color: def.color,
      earned_at: row.earned_at,
      metadata: row.metadata,
    };
  });
}

async function getStreak(userId) {
  const r = await db.pool.query(
    `SELECT current_streak, longest_streak, total_active_days, last_active_date
       FROM user_streaks WHERE user_id = $1`,
    [userId]
  );
  if (!r.rowCount) return { current: 0, longest: 0, total: 0, last: null };
  const row = r.rows[0];

  // If last activity was more than one day ago, streak has lapsed.
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const last  = row.last_active_date ? new Date(row.last_active_date) : null;
  let current = row.current_streak;
  if (last) {
    const diffDays = Math.floor((today - last) / 86400000);
    if (diffDays > 1) current = 0;
  }
  return {
    current: current,
    longest: row.longest_streak,
    total: row.total_active_days,
    last: row.last_active_date,
  };
}

async function getOverview(userId) {
  const userRow = (await db.pool.query(
    `SELECT id, name, email, role, verified, is_protected, suspended, created_at
       FROM users WHERE id = $1`, [userId]
  )).rows[0];
  if (!userRow) return null;

  const [badges, streak] = await Promise.all([
    getUserBadges(userId),
    getStreak(userId),
  ]);

  return {
    user: {
      id: userRow.id,
      name: userRow.name,
      email: userRow.email,
      role: userRow.role,
      verified: userRow.verified,
      is_protected: userRow.is_protected,
      suspended: userRow.suspended,
      created_at: userRow.created_at,
    },
    badges: badges,
    streak: streak,
    total_badges: Object.keys(BADGES).length,
  };
}

module.exports = {
  recordActivity, checkAndAward, award,
  getUserBadges, getStreak, getOverview,
};
