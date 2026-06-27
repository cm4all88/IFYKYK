-- ──────────────────────────────────────────────────────────────────
-- Migration 055 — Backfill referral codes for everyone
-- Referral codes were generated lazily (only when someone opened their
-- referral panel), so most subscribers never had one and their link showed
-- as empty in admin. This gives every existing account a stable code now.
-- New accounts get one at signup (see signup flows). Run in Supabase.
-- ──────────────────────────────────────────────────────────────────

select public.ensure_referral_code(u.id)
from auth.users u
where not exists (
  select 1 from public.referral_codes c where c.owner_user_id = u.id
);

select 'Migration 055 complete — referral codes backfilled' as result;
