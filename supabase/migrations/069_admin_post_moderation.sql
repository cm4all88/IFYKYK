-- ─────────────────────────────────────────────────────────────────────────────
-- 069_admin_post_moderation.sql
--
-- Admin review of every post on the platform (/admin/posts).
--
--   1. Removal columns on posts, so a removed post keeps its history and can be
--      restored exactly as it was.
--   2. A trigger that stops a creator (anon / authenticated roles) from undoing
--      an admin decision: they cannot change moderation_status or the removal
--      columns, and cannot put a removed post back live from their archive page.
--      The service role (admin routes, webhooks, cron) is unaffected.
--   3. admin_post_actions: append only audit log, service role only.
--
-- Additive. No post is modified by this migration.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

alter table public.posts add column if not exists removed_by_admin_at    timestamptz;
alter table public.posts add column if not exists removed_reason         text;
alter table public.posts add column if not exists status_before_removal  text;
alter table public.posts add column if not exists moderation_reviewed_at timestamptz;

create index if not exists posts_created_idx    on public.posts (created_at desc);
create index if not exists posts_moderation_idx on public.posts (moderation_status, created_at desc);

create or replace function public.posts_protect_moderation() returns trigger
language plpgsql as $$
begin
  if coalesce(auth.role(), '') in ('anon', 'authenticated') then
    new.moderation_status      := old.moderation_status;
    new.moderation_note        := old.moderation_note;
    new.removed_by_admin_at    := old.removed_by_admin_at;
    new.removed_reason         := old.removed_reason;
    new.status_before_removal  := old.status_before_removal;
    new.moderation_reviewed_at := old.moderation_reviewed_at;
    if old.removed_by_admin_at is not null and new.status in ('live', 'scheduled') then
      raise exception 'This post was removed by Spotlightly and cannot be republished.' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_posts_protect_moderation on public.posts;
create trigger trg_posts_protect_moderation
  before update on public.posts
  for each row execute function public.posts_protect_moderation();

create table if not exists public.admin_post_actions (
  id                  uuid primary key default gen_random_uuid(),
  post_id             uuid not null,
  creator_profile_id  uuid,
  action              text not null check (action in ('approve', 'flag', 'remove', 'restore')),
  reason              text,
  admin_email         text not null,
  before              jsonb not null default '{}'::jsonb,
  after               jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now()
);
create index if not exists apa_post_idx    on public.admin_post_actions (post_id, created_at desc);
create index if not exists apa_creator_idx on public.admin_post_actions (creator_profile_id, created_at desc);

alter table public.admin_post_actions enable row level security;
revoke all on public.admin_post_actions from anon, authenticated;
grant all on public.admin_post_actions to service_role;

create or replace function public.admin_post_actions_append_only() returns trigger
language plpgsql as $$ begin raise exception 'admin_post_actions is append only'; end $$;
drop trigger if exists trg_admin_post_actions_append_only on public.admin_post_actions;
create trigger trg_admin_post_actions_append_only
  before update or delete on public.admin_post_actions
  for each row execute function public.admin_post_actions_append_only();

commit;

-- ROLLBACK
--   begin;
--   drop trigger if exists trg_posts_protect_moderation on public.posts;
--   drop function if exists public.posts_protect_moderation();
--   drop trigger if exists trg_admin_post_actions_append_only on public.admin_post_actions;
--   drop function if exists public.admin_post_actions_append_only();
--   drop table if exists public.admin_post_actions;
--   commit;
-- The posts columns are left in place; they record decisions already made.
