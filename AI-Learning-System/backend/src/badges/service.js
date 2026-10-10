// ============================================================
// badges/service.js
// ------------------------------------------------------------
// Awards badges, tracks streaks, computes progress toward
// in-progress badges, and supports reset + re-earn.
// ============================================================

const db = require('../db');
const logger = require('../core/logger');
const { BADGES } = require('./definitions');

/* ============================================================
   ACTIVITY TRACKING
   ============================================================ */
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

/* ============================================================
   AWARD
   - If row doesn't exist, insert with earned_at = now
   - If row exists with earned_at = NULL (after reset), re-earn it
   - If row already earned, do nothing
   Returns true if newly earned (either first time or after reset)
   ============================================================ */
async function award(userId, badgeKey, metadata) {
  if (!userId || !badgeKey) return false;
  try {
    const r = await db.pool.query(
      `INSERT INTO user_badges (user_id, badge_key, earned_at, metadata)
       VALUES ($1, $2, now(), $3)
       ON CONFLICT (user_id, badge_key) DO NOTHING
       RETURNING id`,
      [userId, badgeKey, metadata || {}]
    );
    return r.rowCount > 0;
  } catch (err) {
    // Log the real reason once, then stop trying (prevents log spam)
    if (!award.__logged) award.__logged = {};
    if (!award.__logged[badgeKey]) {
      award.__logged[badgeKey] = true;
      console.warn('[badges] award failed for ' + badgeKey + ': ' + err.message);
    }
    return false;
  }
}

/* ============================================================
   PROGRESS COMPUTATION
   For a given user, returns a map of { badgeKey: { current, target } }
   ============================================================ */
async function computeProgress(userId) {
  const progress = {};

  function set(key, current, target) {
    progress[key] = { current: current || 0, target: target };
  }

  try {
    // Chats
    const chats = (await db.pool.query(
      `SELECT COUNT(*)::int AS n FROM messages m
         JOIN conversations c ON c.id = m.conversation_id
        WHERE c.user_id = $1 AND m.role = 'user'`, [userId]
    )).rows[0].n;
    set('first_chat',        Math.min(chats, 1),  1);
    set('knowledge_seeker',  Math.min(chats, 100), 100);
    set('question_master',   Math.min(chats, 500), 500);

    // Quizzes
    const quizzes = (await db.pool.query(
      `SELECT COUNT(*)::int AS n FROM quizzes WHERE user_id = $1`, [userId]
    )).rows[0].n;
    set('first_quiz', Math.min(quizzes, 1), 1);
    set('quiz_5',     Math.min(quizzes, 5),  5);
    set('quiz_10',    Math.min(quizzes, 10), 10);
    set('quiz_25',    Math.min(quizzes, 25), 25);
    set('quiz_50',    Math.min(quizzes, 50), 50);
    set('quiz_100',   Math.min(quizzes, 100), 100);

    // Perfect quizzes (assume quizzes has a score and total)
    const perfect = (await db.pool.query(
      `SELECT COUNT(*)::int AS n FROM quizzes
        WHERE user_id = $1 AND score = total AND total > 0`, [userId]
    ).catch(() => ({ rows: [{ n: 0 }] }))).rows[0].n;
    set('perfect_quiz', Math.min(perfect, 1), 1);
    set('perfect_3',    Math.min(perfect, 3), 3);

    // Flashcards
    const flashcards = (await db.pool.query(
      `SELECT COUNT(*)::int AS n FROM flashcard_reviews fr
         JOIN flashcards f ON f.id = fr.card_id
         JOIN flashcard_decks d ON d.id = f.deck_id
        WHERE d.user_id = $1`, [userId]
    ).catch(() => ({ rows: [{ n: 0 }] }))).rows[0].n;
    set('first_flashcard', Math.min(flashcards, 1), 1);
    set('flashcard_10',    Math.min(flashcards, 10), 10);
    set('flashcard_100',   Math.min(flashcards, 100), 100);
    set('flashcard_500',   Math.min(flashcards, 500), 500);

    // Theory
    const theory = (await db.pool.query(
      `SELECT COUNT(*)::int AS n FROM theory_attempts WHERE user_id = $1`, [userId]
    ).catch(() => ({ rows: [{ n: 0 }] }))).rows[0].n;
    set('first_theory', Math.min(theory, 1), 1);

    // Notes
    const notes = (await db.pool.query(
      `SELECT COUNT(*)::int AS n FROM notes WHERE user_id = $1`, [userId]
    ).catch(() => ({ rows: [{ n: 0 }] }))).rows[0].n;
    set('first_note', Math.min(notes, 1), 1);

    // Sketches
    const sketches = (await db.pool.query(
      `SELECT COUNT(*)::int AS n FROM sketches WHERE user_id = $1`, [userId]
    ).catch(() => ({ rows: [{ n: 0 }] }))).rows[0].n;
    set('first_sketch', Math.min(sketches, 1), 1);

    // Streaks
    const streakRow = (await db.pool.query(
      `SELECT current_streak, longest_streak FROM user_streaks WHERE user_id = $1`, [userId]
    )).rows[0] || { current_streak: 0, longest_streak: 0 };
    const s = streakRow.longest_streak || 0;
    set('streak_3',  Math.min(s, 3),  3);
    set('streak_7',  Math.min(s, 7),  7);
    set('streak_14', Math.min(s, 14), 14);
    set('streak_30', Math.min(s, 30), 30);

    // Total active time (approximate: total_active_days * 30 min)
    const activeDays = (await db.pool.query(
      `SELECT total_active_days FROM user_streaks WHERE user_id = $1`, [userId]
    )).rows[0];
    const activeHours = Math.floor((activeDays ? activeDays.total_active_days : 0) * 0.5);
    set('hour_1',  Math.min(activeHours, 1),  1);
    set('hour_10', Math.min(activeHours, 10), 10);
    set('hour_50', Math.min(activeHours, 50), 50);

    // Subject diversity
    const subjects = (await db.pool.query(
      `SELECT COUNT(DISTINCT topic)::int AS n FROM quizzes
        WHERE user_id = $1 AND topic IS NOT NULL AND topic <> ''`, [userId]
    ).catch(() => ({ rows: [{ n: 0 }] }))).rows[0].n;
    set('multi_subject', Math.min(subjects, 5), 5);

    // Bio / Math / Chem master
    const bioN = (await db.pool.query(
      `SELECT COUNT(*)::int AS n FROM quizzes
        WHERE user_id = $1 AND LOWER(topic) LIKE '%biolog%'`, [userId]
    ).catch(() => ({ rows: [{ n: 0 }] }))).rows[0].n;
    const mathN = (await db.pool.query(
      `SELECT COUNT(*)::int AS n FROM quizzes
        WHERE user_id = $1 AND (LOWER(topic) LIKE '%math%' OR LOWER(topic) LIKE '%algebra%' OR LOWER(topic) LIKE '%geometry%')`, [userId]
    ).catch(() => ({ rows: [{ n: 0 }] }))).rows[0].n;
    const chemN = (await db.pool.query(
      `SELECT COUNT(*)::int AS n FROM quizzes
        WHERE user_id = $1 AND LOWER(topic) LIKE '%chem%'`, [userId]
    ).catch(() => ({ rows: [{ n: 0 }] }))).rows[0].n;
    set('bio_master', Math.min(bioN, 10),  10);
    set('math_whiz',  Math.min(mathN, 10), 10);
    set('chem_whiz',  Math.min(chemN, 10), 10);

    // Explorer — count distinct tool types used
    // Simple heuristic: has used each of 9 tools at least once
    let explorerCount = 0;
    if (quizzes > 0)      explorerCount++;
    if (flashcards > 0)   explorerCount++;
    if (theory > 0)       explorerCount++;
    if (notes > 0)        explorerCount++;
    if (sketches > 0)     explorerCount++;
    if (chats > 0)        explorerCount++;
    // Check for practice, visualization, exam separately
    const practice = (await db.pool.query(
      `SELECT COUNT(*)::int AS n FROM practice_sets WHERE user_id = $1`, [userId]
    ).catch(() => ({ rows: [{ n: 0 }] }))).rows[0].n;
    if (practice > 0) explorerCount++;
    const exams = (await db.pool.query(
      `SELECT COUNT(*)::int AS n FROM quizzes WHERE user_id = $1 AND time_limit_seconds IS NOT NULL`, [userId]
    ).catch(() => ({ rows: [{ n: 0 }] }))).rows[0].n;
    if (exams > 0) explorerCount++;
    // Theory counted, need one more for 9 tools: count exam as separate, or count any 8
    // Set target to 8 for now
    set('explorer', Math.min(explorerCount, 8), 8);

  } catch (err) {
    logger.warn('[badges] computeProgress partial failure: ' + err.message);
  }

  return progress;
}

/* ============================================================
   CHECK AND AWARD
   Looks at the user's history, awards every badge they've earned
   that hasn't been awarded yet (or has been reset).
   ============================================================ */
async function checkAndAward(userId) {
  const awarded = [];
  try {
    const progress = await computeProgress(userId);

    // Award anything where current >= target
    for (const key of Object.keys(progress)) {
      const p = progress[key];
      if (p.current >= p.target && BADGES[key]) {
        const wasNew = await award(userId, key, { progress: p });
        if (wasNew) awarded.push(key);
      }
    }

    // Time-of-day badges: check the current hour
    const hour = new Date().getHours();
    if (hour < 7) {
      if (await award(userId, 'early_bird')) awarded.push('early_bird');
    }
    if (hour >= 22) {
      if (await award(userId, 'night_owl')) awarded.push('night_owl');
    }

    // Verified flag
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

/* ============================================================
   RESET A BADGE
   Sets earned_at to NULL, bumps reset_count, keeps history.
   ============================================================ */
async function resetBadge(userId, badgeKey) {
  if (!BADGES[badgeKey]) return { ok: false, code: 'UNKNOWN_BADGE' };

  const row = (await db.pool.query(
    `SELECT id, earned_at FROM user_badges WHERE user_id = $1 AND badge_key = $2`,
    [userId, badgeKey]
  )).rows[0];

  if (!row) return { ok: false, code: 'NOT_EARNED' };
  if (!row.earned_at) return { ok: false, code: 'NOT_EARNED' };

  await db.pool.query(
    `UPDATE user_badges
        SET earned_at = NULL,
            completed_at = NULL,
            duration_seconds = NULL,
            started_at = now(),
            reset_count = reset_count + 1,
            progress_data = '{}'::jsonb
      WHERE user_id = $1 AND badge_key = $2`,
    [userId, badgeKey]
  );

  return { ok: true };
}

/* ============================================================
   GETTERS
   ============================================================ */
async function getUserBadges(userId) {
  const r = await db.pool.query(
    `SELECT badge_key, earned_at, completed_at, duration_seconds,
            reset_count, started_at, progress_data, times_completed
       FROM user_badges
      WHERE user_id = $1
      ORDER BY earned_at DESC NULLS LAST`,
    [userId]
  );
  return r.rows.map(function (row) {
    const def = BADGES[row.badge_key] || { name: row.badge_key, desc: '', icon: 'fa-medal', color: 'navy', category: 'other' };
    return {
      key: row.badge_key,
      name: def.name,
      desc: def.desc,
      icon: def.icon,
      color: def.color,
      category: def.category,
      earned: !!row.earned_at,
      earned_at: row.earned_at,
      completed_at: row.completed_at,
      duration_seconds: row.duration_seconds,
      reset_count: row.reset_count,
      times_completed: row.times_completed || 0,
      progress_data: row.progress_data,
    };
  });
}

async function getBadgeHistory(userId, limit) {
  limit = Math.min(200, limit || 50);
  const r = await db.pool.query(
    `SELECT badge_key, completed_at, duration_seconds, reset_round, metadata
       FROM user_badge_history
      WHERE user_id = $1
      ORDER BY completed_at DESC
      LIMIT $2`,
    [userId, limit]
  );
  return r.rows.map(function (row) {
    const def = BADGES[row.badge_key] || {};
    return {
      key: row.badge_key,
      name: def.name || row.badge_key,
      icon: def.icon || 'fa-medal',
      completed_at: row.completed_at,
      duration_seconds: row.duration_seconds,
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

  const [badges, streak, progress] = await Promise.all([
    getUserBadges(userId),
    getStreak(userId),
    computeProgress(userId),
  ]);

  // Filter progress to only in-progress badges (not yet earned)
  const earnedKeys = new Set(badges.filter(b => b.earned).map(b => b.key));
  const inProgress = {};
  for (const k of Object.keys(progress)) {
    if (!earnedKeys.has(k)) inProgress[k] = progress[k];
  }

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
    progress: inProgress,
    total_badges: Object.keys(BADGES).length,
  };
}

module.exports = {
  recordActivity, checkAndAward, award,
  getUserBadges, getBadgeHistory, getStreak, getOverview,
  resetBadge, computeProgress,
};
