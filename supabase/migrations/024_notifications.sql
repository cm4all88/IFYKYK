-- Migration 024: Creator notifications
create table if not exists public.notifications (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete cascade not null,
  type            text not null check (type in ('new_subscriber','tip','super_tip','new_comment','campaign_donation','gift_sub','message','live_viewer')),
  title           text not null,
  body            text,
  link            text,
  read            boolean default false,
  created_at      timestamptz default now()
);

create index notifications_user_unread on public.notifications(user_id, read, created_at desc);

alter table public.notifications enable row level security;

create policy "Users see own notifications"
  on notifications for select using (user_id = auth.uid());

create policy "Users can mark own as read"
  on notifications for update using (user_id = auth.uid());
