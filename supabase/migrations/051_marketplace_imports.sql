-- Migration 051: Marketplace Importing ("Import Existing Listings")
-- Lets a creator bring their existing store (Poshmark, Mercari, eBay, Etsy,
-- Depop, Facebook Marketplace, or a CSV / photo upload) into Spotlightly as
-- DRAFT marketplace listings. Photos are copied into Spotlightly storage by the
-- import routes, never hotlinked. Nothing publishes until the creator approves.

-- One row per import attempt, for the Import Dashboard counters.
create table if not exists public.import_runs (
  id                  uuid primary key default gen_random_uuid(),
  creator_profile_id  uuid references public.creator_profiles(id) on delete cascade not null,
  source              text not null,            -- poshmark | mercari | ebay | etsy | depop | facebook | csv | photos | capture | other
  source_username     text,
  status              text not null default 'running' check (status in ('running','complete','failed')),
  listings_found      int  not null default 0,  -- candidate listings the source saw
  listings_imported   int  not null default 0,  -- drafts actually created
  listings_skipped    int  not null default 0,
  photos_saved        int  not null default 0,  -- images copied into Spotlightly storage
  photos_failed       int  not null default 0,
  errors              jsonb not null default '[]'::jsonb,
  created_at          timestamptz not null default now(),
  completed_at        timestamptz
);

create index if not exists import_runs_creator_idx
  on public.import_runs(creator_profile_id, created_at desc);

alter table public.import_runs enable row level security;

drop policy if exists "Creators manage own import runs" on public.import_runs;
create policy "Creators manage own import runs"
  on public.import_runs for all using (
    creator_profile_id in (select id from public.creator_profiles where user_id = auth.uid())
  );

-- Draft status: an imported listing waits in 'draft' until the creator approves
-- it. Public can only ever see 'active' (existing policy), so drafts stay private.
alter table public.marketplace_listings
  drop constraint if exists marketplace_listings_status_check;
alter table public.marketplace_listings
  add constraint marketplace_listings_status_check
  check (status in ('draft','active','sold','archived'));

-- Where the listing came from, plus the extra fields the importer captures.
alter table public.marketplace_listings
  add column if not exists source_platform text,
  add column if not exists source_url      text,
  add column if not exists source_username text,
  add column if not exists brand           text,
  add column if not exists size            text,
  add column if not exists needs_photos    boolean not null default false,
  add column if not exists import_run_id   uuid references public.import_runs(id) on delete set null,
  add column if not exists imported_at     timestamptz;

create index if not exists marketplace_listings_import_idx
  on public.marketplace_listings(import_run_id);
