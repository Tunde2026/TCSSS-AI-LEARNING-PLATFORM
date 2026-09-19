-- FROZEN AFTER MERGE. Add new migrations as 009_*.sql

-- Add processing columns to library_documents
ALTER TABLE library_documents
  ADD COLUMN IF NOT EXISTS processing_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS processing_error  TEXT,
  ADD COLUMN IF NOT EXISTS processed_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS chunk_count       INTEGER NOT NULL DEFAULT 0;

-- Text chunks + embeddings for RAG
CREATE TABLE IF NOT EXISTS document_chunks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  UUID NOT NULL REFERENCES library_documents(id) ON DELETE CASCADE,
  position     INTEGER NOT NULL,
  content      TEXT NOT NULL,
  embedding    vector(768),
  approved     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS document_chunks_document_idx
  ON document_chunks (document_id, position);

CREATE INDEX IF NOT EXISTS document_chunks_approved_idx
  ON document_chunks (approved);

-- HNSW index for fast cosine similarity search
CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx
  ON document_chunks USING hnsw (embedding vector_cosine_ops);