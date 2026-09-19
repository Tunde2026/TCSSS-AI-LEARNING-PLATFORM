-- FROZEN AFTER MERGE. Add new migrations as 007_*.sql

CREATE TABLE IF NOT EXISTS flashcard_decks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  topic       TEXT NOT NULL,
  subject     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS flashcard_decks_user_idx
  ON flashcard_decks (user_id, created_at DESC);

-- SRS state lives on the card itself for fast "due now" queries.
CREATE TABLE IF NOT EXISTS flashcards (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id           UUID NOT NULL REFERENCES flashcard_decks(id) ON DELETE CASCADE,
  position          INTEGER NOT NULL,
  front             TEXT NOT NULL,
  back              TEXT NOT NULL,
  interval_days     INTEGER NOT NULL DEFAULT 0,
  ease              REAL    NOT NULL DEFAULT 2.5,
  due_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_reviewed_at  TIMESTAMPTZ,
  review_count      INTEGER NOT NULL DEFAULT 0,
  correct_count     INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS flashcards_deck_idx
  ON flashcards (deck_id, position);

CREATE INDEX IF NOT EXISTS flashcards_due_idx
  ON flashcards (deck_id, due_at);

CREATE TABLE IF NOT EXISTS flashcard_reviews (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id       UUID NOT NULL REFERENCES flashcards(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quality       INTEGER NOT NULL,
  interval_days INTEGER NOT NULL,
  reviewed_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS flashcard_reviews_user_idx
  ON flashcard_reviews (user_id, reviewed_at DESC);