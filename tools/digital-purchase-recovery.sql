-- ─────────────────────────────────────────────────────────────────────────────
-- Digital purchase recovery
-- Run these in order in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. DID THE WEBHOOK LAND?
--    If this returns a row, the webhook worked and only the email failed.
--    If it returns nothing, the webhook never arrived and Stripe took money
--    without the app ever hearing about it.
--
--    Replace the email with the buyer's. Or drop the where clause entirely to
--    see every digital sale you have ever had.
select
  p.created_at,
  p.fan_email,
  p.amount_paid,
  p.download_count,
  d.title              as product,
  d.status             as product_status,
  d.file_url is not null as has_file,
  'https://www.spotlightly.app/api/digital/download?token=' || p.download_token
                       as download_link
from public.digital_purchases p
join public.digital_products d on d.id = p.digital_product_id
-- where lower(p.fan_email) = lower('buyer@example.com')
order by p.created_at desc
limit 20;


-- 2. IF STEP 1 RETURNED A ROW
--    Copy download_link out of the result and send it to the buyer directly.
--    That is the same link the automated email would have contained. It works
--    immediately and needs nothing else fixed first.
--
--    Then check whether the product is even deliverable. If product_status is
--    not 'active', or has_file is false, the buyer paid for something that was
--    never publishable, and the link will fail when they click it.


-- 3. IF STEP 1 RETURNED NOTHING
--    The webhook never fired. Do NOT insert the row by hand: the download token,
--    the sales counter, and the creator's notification all come from the same
--    code path, and a hand-built row will be missing pieces.
--
--    Instead, fix the endpoint in Stripe, then resend the original event from
--    Stripe's dashboard. stripe_session_id is UNIQUE on this table, so a replay
--    cannot create a duplicate purchase even if you resend more than once.
--    That constraint is why replaying is the safe move here.


-- 4. SANITY CHECK: products that can never be delivered.
--    Anything listed here will take money and hand the buyer a broken link.
select
  d.id,
  d.title,
  d.status,
  d.price,
  d.file_url is null as missing_file,
  d.storage_provider
from public.digital_products d
where d.status <> 'archived'
  and (d.file_url is null or d.status <> 'active')
order by d.created_at desc;
