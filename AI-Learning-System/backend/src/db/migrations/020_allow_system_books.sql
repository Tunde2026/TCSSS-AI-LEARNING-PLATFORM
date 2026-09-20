-- FROZEN AFTER MERGE. Add new migrations as 021_*.sql
-- Allow auto-fetched books without a human uploader.

ALTER TABLE library_documents
  ALTER COLUMN uploaded_by DROP NOT NULL;
