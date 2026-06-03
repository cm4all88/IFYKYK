-- 031_post_likes.sql
-- Per-user likes for posts. posts.likes_count (added in 001) is kept in sync by a trigger.

create table if not exists public.post_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

create index if not exists post_likes_post_idx on public.post_likes(post_id);
create index if not exists post_likes_user_idx on public.post_likes(user_id);

alter table public.post_likes enable row level security;

-- Like rows are not sensitive (counts are public); allow reads, but a user may only
-- create/remove their own like.
drop policy if exists "post_likes readable" on public.post_likes;
create policy "post_likes readable" on public.post_likes for select using (true);

drop policy if exists "post_likes insert own" on public.post_likes;
create policy "post_likes insert own" on public.post_likes for insert with check (auth.uid() = user_id);

drop policy if exists "post_likes delete own" on public.post_likes;
create policy "post_likes delete own" on public.post_likes for delete using (auth.uid() = user_id);

-- Keep the denormalized counter on posts in sync.
create or replace function public.sync_post_likes_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    update public.posts set likes_count = coalesce(likes_count, 0) + 1 where id = new.post_id;
    return new;
  elsif (tg_op = 'DELETE') then
    update public.posts set likes_count = greatest(coalesce(likes_count, 0) - 1, 0) where id = old.post_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_sync_post_likes on public.post_likes;
create trigger trg_sync_post_likes
after insert or delete on public.post_likes
for each row execute function public.sync_post_likes_count();
