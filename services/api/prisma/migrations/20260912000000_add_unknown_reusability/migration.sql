-- Add the 'unknown' reusability value to DocumentReusability so the importer can
-- record a genuine "not established by source" reusability state for documents
-- like DOC-015..DOC-018, instead of silently coercing it to 'fresh_required'.
ALTER TYPE "DocumentReusability" ADD VALUE 'unknown';