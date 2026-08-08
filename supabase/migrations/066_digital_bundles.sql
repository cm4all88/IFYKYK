-- ─────────────────────────────────────────────────────────────────────────────
-- 066_digital_bundles.sql
--
-- A bundle is a digital product that contains other digital products instead of
-- its own file. The creator picks what goes in and sets a price below the sum,
-- and the buyer gets every included file from one purchase.
--
-- Why this rather than a cart: "buy 2 get 1 free" needs checkout to know what
-- else is in the order, and every Buy button here is its own single-line Stripe
-- session. A bundle gets the same commercial effect (spend more, pay less per
-- item) without rebuilding checkout, and it matches how photo sets actually sell.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.digital_products
  add column if not exists bundled_product_ids uuid[] not null default '{}';

comment on column public.digital_products.bundled_product_ids is
  'Non-empty means this product is a bundle. Its own file_url is unused; the buyer receives the file of every product listed here.';

-- A bundle needs no file of its own, but a normal product still does. Enforce
-- exactly that: one or the other, never neither.
alter table public.digital_products
  drop constraint if exists digital_products_deliverable;
alter table public.digital_products
  add constraint digital_products_deliverable check (
    status <> 'active'
    or file_url is not null
    or array_length(bundled_product_ids, 1) > 0
  );

create index if not exists digital_products_bundled_idx
  on public.digital_products using gin (bundled_product_ids);
