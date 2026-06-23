-- Migration 052: a soft "double-check this" flag for imported drafts.
-- Set when a draft came from screenshots or the AI wasn't confident. Cleared the
-- moment the creator saves edits or publishes. Never blocks anything; it only
-- surfaces a badge on the approval screen so nothing uncertain slips through.
alter table public.marketplace_listings
  add column if not exists needs_review boolean not null default false;
