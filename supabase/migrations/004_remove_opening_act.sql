-- ──────────────────────────────────────────────────────────────────
-- Migration 004 — Remove Opening Act tier
-- Spotlightly is now 18+ only: Spotlight + Backstage
-- Safe to run multiple times (all ops are idempotent)
-- ──────────────────────────────────────────────────────────────────

-- 1. Update any opening_act creator_profiles rows to spotlight
update public.creator_profiles
  set creator_type = 'spotlight'
  where creator_type = 'opening_act';

-- 2. Update the check constraint on creator_profiles
alter table public.creator_profiles
  drop constraint if exists creator_profiles_creator_type_check;

alter table public.creator_profiles
  add constraint creator_profiles_creator_type_check
  check (creator_type in ('spotlight', 'backstage'));

-- 3. Update the creators table (legacy, if it exists)
do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'creators') then
    update public.creators set creator_type = 'sfw' where creator_type = 'young';
    begin
      alter table public.creators
        drop constraint if exists creators_creator_type_check;
      alter table public.creators
        add constraint creators_creator_type_check
        check (creator_type in ('sfw', 'adult'));
    exception when others then null;
    end;
  end if;
end $$;

-- 4. Drop parental_tokens table if it exists
drop table if exists public.parental_tokens cascade;

-- 5. Remove Opening Act columns from creator_profiles (if they exist)
alter table public.creator_profiles
  drop column if exists date_of_birth,
  drop column if exists parental_consent_at,
  drop column if exists graduated_at;

-- 6. Remove the cron graduate endpoint's associated secret if present
delete from public.platform_settings where key = 'CRON_SECRET';

-- Done
select 'Migration 004 complete — Opening Act removed' as result;
