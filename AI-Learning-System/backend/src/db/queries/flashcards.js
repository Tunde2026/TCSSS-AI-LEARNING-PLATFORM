const { pool } = require('../pool');

async function createDeck({ userId, title, topic, subject, description = null }) {
  const { rows } = await pool.query(
    `INSERT INTO flashcard_decks (user_id, title, topic, subject, description)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, user_id, title, topic, subject, description, created_at, updated_at`,
    [userId, title, topic, subject || null, description]
  );
  return rows[0];
}

async function addCards(deckId, cards) {
  const params = [deckId];
  const values = [];
  cards.forEach((c, i) => {
    const o = params.length;
    values.push(`($1, $${o + 1}, $${o + 2}, $${o + 3})`);
    params.push(i + 1, c.front, c.back);
  });
  await pool.query(
    `INSERT INTO flashcards (deck_id, position, front, back)
     VALUES ${values.join(', ')}`,
    params
  );
}

async function findDeck(id) {
  const { rows } = await pool.query(
    `SELECT id, user_id, title, topic, subject, description, created_at, updated_at
       FROM flashcard_decks WHERE id = $1`,
    [id]
  );
  if (!rows[0]) return null;
  const deck = rows[0];
  const c = await pool.query(
    `SELECT id, position, front, back, interval_days, ease, due_at,
            last_reviewed_at, review_count, correct_count
       FROM flashcards
      WHERE deck_id = $1
      ORDER BY position ASC`,
    [id]
  );
  deck.cards = c.rows;
  return deck;
}

async function listDecks(userId) {
  const { rows } = await pool.query(
    `SELECT d.id, d.title, d.topic, d.subject, d.description,
            d.created_at, d.updated_at,
            COUNT(c.id)::int AS card_count,
            COUNT(CASE WHEN c.due_at <= now() THEN 1 END)::int AS due_count
       FROM flashcard_decks d
       LEFT JOIN flashcards c ON c.deck_id = d.id
      WHERE d.user_id = $1
      GROUP BY d.id
      ORDER BY d.created_at DESC`,
    [userId]
  );
  return rows;
}

async function setDescription(id, userId, description) {
  const { rows } = await pool.query(
    `UPDATE flashcard_decks SET description = $1, updated_at = now()
      WHERE id = $2 AND user_id = $3
      RETURNING id, title, topic, subject, description, created_at, updated_at`,
    [description || null, id, userId]
  );
  return rows[0] || null;
}

async function removeDeck(id, userId) {
  const { rowCount } = await pool.query(
    `DELETE FROM flashcard_decks WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  return rowCount > 0;
}

async function dueCards(deckId, limit = 50) {
  const { rows } = await pool.query(
    `SELECT id, position, front, back, interval_days, ease, due_at,
            last_reviewed_at, review_count, correct_count
       FROM flashcards
      WHERE deck_id = $1 AND due_at <= now()
      ORDER BY due_at ASC
      LIMIT $2`,
    [deckId, limit]
  );
  return rows;
}

async function reviewCard({ cardId, userId, quality }) {
  const { rows } = await pool.query(
    `SELECT interval_days, ease, review_count, correct_count
       FROM flashcards WHERE id = $1`,
    [cardId]
  );
  const card = rows[0];
  if (!card) return null;

  let interval = card.interval_days;
  let ease     = card.ease;
  let correct  = card.correct_count;

  if (quality === 0) {
    interval = 0;
    ease = Math.max(1.3, ease - 0.2);
  } else if (quality === 1) {
    interval = interval === 0 ? 1 : Math.round(interval * 1.2);
  } else if (quality === 2) {
    interval = interval === 0 ? 1 : Math.round(interval * ease);
    correct += 1;
  } else {
    interval = interval === 0 ? 2 : Math.round(interval * ease * 1.3);
    ease = Math.min(3.0, ease + 0.15);
    correct += 1;
  }

  const updateSql = interval === 0
    ? `UPDATE flashcards
          SET interval_days = 0, ease = $2, due_at = now() + interval '1 minute',
              last_reviewed_at = now(),
              review_count = review_count + 1
        WHERE id = $3
        RETURNING id, interval_days, ease, due_at, review_count, correct_count`
    : `UPDATE flashcards
          SET interval_days = $1, ease = $2,
              due_at = now() + ($1 || ' days')::interval,
              last_reviewed_at = now(),
              review_count = review_count + 1,
              correct_count = $4
        WHERE id = $3
        RETURNING id, interval_days, ease, due_at, review_count, correct_count`;

  const params = interval === 0
    ? [interval, ease, cardId]
    : [interval, ease, cardId, correct];

  const updated = await pool.query(updateSql, params);
  const result = updated.rows[0];

  await pool.query(
    `INSERT INTO flashcard_reviews (card_id, user_id, quality, interval_days)
     VALUES ($1, $2, $3, $4)`,
    [cardId, userId, quality, result.interval_days]
  );

  return result;
}

module.exports = {
  createDeck, addCards, findDeck, listDecks, setDescription, removeDeck,
  dueCards, reviewCard,
};