-- ──────────────────────────────────────────────────────────────────
-- 008_contact_blocks.sql
-- Pre-emptive contact blocking: creators upload email/phone hashes
-- to block people before they ever subscribe.
-- Contact info is stored as SHA-256 hashes — raw values never stored.
-- ──────────────────────────────────────────────────────────────────

create table if not exists public.creator_contact_blocks (
  id                  uuid primary key default gen_random_uuid(),
  creator_profile_id  uuid references public.creator_profiles(id) on delete cascade not null,
  contact_type        text not null check (contact_type in ('email', 'phone')),
  -- SHA-256 hash of lowercased/normalized contact value
  contact_hash        text not null,
  -- Partial display only (e.g. "j••••@gmail.com") — never the full value
  display_hint        text not null,
  note                text, -- creator's private note, e.g. "my ex"
  created_at          timestamptz not null default now()
);

create unique index if not exists creator_contact_blocks_unique
  on public.creator_contact_blocks (creator_profile_id, contact_hash);

alter table public.creator_contact_blocks enable row level security;

-- Creators can only manage their own block list
create policy "creator_contact_blocks_select" on public.creator_contact_blocks
  for select using (
    creator_profile_id in (
      select id from public.creator_profiles where user_id = auth.uid()
    )
  );

create policy "creator_contact_blocks_insert" on public.creator_contact_blocks
  for insert with check (
    creator_profile_id in (
      select id from public.creator_profiles where user_id = auth.uid()
    )
  );

create policy "creator_contact_blocks_delete" on public.creator_contact_blocks
  for delete using (
    creator_profile_id in (
      select id from public.creator_profiles where user_id = auth.uid()
    )
  );
