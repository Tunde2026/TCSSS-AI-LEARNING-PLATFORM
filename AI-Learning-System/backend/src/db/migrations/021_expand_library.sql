-- FROZEN AFTER MERGE. Add new migrations as 022_*.sql

-- Increase per-source limit
UPDATE library_sources SET max_items = 40;

-- Add more subjects
INSERT INTO library_sources (name, source_type, query, subject, max_items) VALUES
  ('Gutenberg — Science',     'gutenberg', 'science',      'Science',     40),
  ('Gutenberg — Geography',   'gutenberg', 'geography',    'Geography',   30),
  ('Gutenberg — Literature',  'gutenberg', 'literature',   'Literature',  40),
  ('Gutenberg — Technology',  'gutenberg', 'technology',   'Technology',  30),
  ('Gutenberg — Astronomy',   'gutenberg', 'astronomy',    'Astronomy',   30),
  ('Gutenberg — Economics',   'gutenberg', 'economics',    'Economics',   30),
  ('Gutenberg — Philosophy',  'gutenberg', 'philosophy',   'Philosophy',  30)
ON CONFLICT DO NOTHING;
