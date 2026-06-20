-- ──────────────────────────────────────────────────────────────────
-- 047_starter_conversion_grace.sql
-- Opening Act → Starter conversion grace state (Phase 1, item 2).
--
-- When a free (Opening Act) creator crosses the Starter threshold, we ask
-- them to move to Starter — but we NEVER lock their page, hide Subscribe,
-- or interrupt their supporters. This column simply marks the moment they
-- became "Starter-due" so the dashboard can show a respectful, persistent
-- upgrade prompt.
--
-- This is deliberately NOT the past_due failure path:
--   • no grace_ends_at countdown
--   • no status change (the creator stays 'free', so isBillingLocked() is
--     already false and entitlements stay Opening Act)
--   • nothing here ever causes a lock or a fan-subscription cancellation
--
-- NULL = not in the conversion grace state (default for every existing row).
-- ──────────────────────────────────────────────────────────────────

alter table creator_billing
  add column if not exists conversion_due_at timestamptz;

comment on column creator_billing.conversion_due_at is
  'Item 2: when a free creator crossed the Starter threshold. NULL = not due. Never causes a lock or any fan-side change; drives a respectful dashboard prompt only.';
