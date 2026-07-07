-- ──────────────────────────────────────────────────────────────────
-- 031_merch_fulfillment.sql
-- Makes the Spotlightly ↔ Loudcap (Printful) link correct and auditable.
--
--   variant_map      size label -> Printful sync_variant_id, captured at
--                    create time so orders ship the EXACT variant a fan
--                    bought (no fuzzy name matching at order time).
--   printful_synced  true only when the product really reached Loudcap.
--                    A product that failed to sync is paused, not silently
--                    "active" and unsellable-to-fulfill.
--   sync_error       the last Loudcap error, surfaced to the creator/admin
--                    instead of being swallowed.
-- ──────────────────────────────────────────────────────────────────

alter table public.merch_products
  add column if not exists variant_map     jsonb   not null default '{}'::jsonb;

alter table public.merch_products
  add column if not exists printful_synced boolean not null default false;

alter table public.merch_products
  add column if not exists sync_error      text;

-- Existing rows created before this migration: if they already carry a real
-- Loudcap id, treat them as synced so they keep selling.
update public.merch_products
  set printful_synced = true
  where coalesce(loudcap_product_id, '') <> ''
    and loudcap_product_id not like 'unfulfilled_%'
    and printful_synced = false;
