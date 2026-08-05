-- ─────────────────────────────────────────────────────────────────────────────
-- 062_digital_storage.sql
-- Digital product files move to Supabase Storage.
--
-- Why: uploads previously went through /api/digital/upload on Vercel, which caps
-- a serverless request body at 4.5 MB. A photo set or a sample pack never fit,
-- and the platform rejected the request before the route ever ran. Supabase
-- Storage is uploaded to directly from the browser, so the cap does not apply.
--
-- Bunny stays where it belongs: live streaming and public media.
-- ─────────────────────────────────────────────────────────────────────────────

-- Private bucket. Nothing here is ever publicly readable; buyers get a
-- short-lived signed URL minted by the download route after a purchase check.
insert into storage.buckets (id, name, public, file_size_limit)
values ('digital-products', 'digital-products', false, 524288000)  -- 500 MB
on conflict (id) do update
  set public = false,
      file_size_limit = 524288000;

-- Files live under a folder named for the owner's user id, so the policies are a
-- simple prefix match: you may only touch your own folder.
drop policy if exists "digital owner insert" on storage.objects;
create policy "digital owner insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'digital-products'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "digital owner read" on storage.objects;
create policy "digital owner read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'digital-products'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "digital owner update" on storage.objects;
create policy "digital owner update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'digital-products'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "digital owner delete" on storage.objects;
create policy "digital owner delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'digital-products'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Buyers never read the bucket directly. The download route uses the service role
-- to mint a signed URL, which bypasses these policies by design.

-- Which backend a given product's bytes live in. Existing rows are Bunny; every
-- new upload is Supabase. Explicit beats inferring it from the URL shape.
alter table public.digital_products
  add column if not exists storage_provider text not null default 'bunny'
    check (storage_provider in ('bunny', 'supabase'));

comment on column public.digital_products.storage_provider is
  'bunny = file_url is a full CDN URL. supabase = file_url is an object path inside the digital-products bucket.';
