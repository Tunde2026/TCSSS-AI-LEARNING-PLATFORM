-- FROZEN AFTER MERGE. Add new migrations as 010_*.sql

CREATE TABLE IF NOT EXISTS system_settings (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  type        TEXT NOT NULL,
  description TEXT,
  category    TEXT NOT NULL DEFAULT 'general',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by  UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS system_settings_category_idx
  ON system_settings (category);

INSERT INTO system_settings (key, value, type, description, category) VALUES
  ('platform.name',              '"AI Learning Platform"',    'string',  'Name shown in sidebar and page titles',                 'general'),
  ('platform.registration_open', 'true',                      'boolean', 'Allow new users to sign up',                            'general'),
  ('chat.default_model',         '"llama3.1:8b"',             'string',  'Default Ollama chat model',                             'ai'),
  ('chat.temperature',           '0.7',                       'number',  'Model temperature (0=strict, 1=creative)',              'ai'),
  ('chat.max_tokens',            '1024',                      'number',  'Max response length in tokens',                         'ai'),
  ('ai.provider_order',          '["groq","cerebras","google","nvidia","openrouter","ollama"]', 'json', 'Provider fallback order',       'ai'),
  ('ai.rag_enabled',             'true',                      'boolean', 'Enable library retrieval in chat',                      'ai'),
  ('ai.websearch_enabled',       'true',                      'boolean', 'Enable web search when relevant',                       'ai'),
  ('ai.voice_enabled',           'false',                     'boolean', 'Enable voice-to-text input',                            'ai'),
  ('ai.embedding_model',         '"nomic-embed-text"',        'string',  'Model used for embeddings',                             'ai'),
  ('tools.quiz_enabled',         'true',                      'boolean', 'Quiz tool available to students',                       'tools'),
  ('tools.flashcards_enabled',   'true',                      'boolean', 'Flashcards tool available to students',                 'tools'),
  ('tools.mistakes_enabled',     'true',                      'boolean', 'Mistake Bank available to students',                    'tools'),
  ('tools.quiz_default_count',   '5',                         'number',  'Default number of quiz questions',                      'tools'),
  ('tools.flashcards_default_count', '10',                    'number',  'Default number of flashcards',                          'tools'),
  ('limits.max_requests_per_minute', '20',                    'number',  'AI requests per user per minute',                       'limits'),
  ('limits.max_message_length',  '4000',                      'number',  'Max characters per user message',                       'limits')
ON CONFLICT (key) DO NOTHING;