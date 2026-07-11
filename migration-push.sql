-- ============================================================
-- THE THRONE — MIGRATION: Push Notifications
-- Run once in Supabase's SQL Editor. Safe on an existing database.
-- ============================================================

create table if not exists push_subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  created_at timestamptz default now()
);
alter table push_subscriptions enable row level security;
drop policy if exists "Users manage their own push subscriptions" on push_subscriptions;
create policy "Users manage their own push subscriptions"
  on push_subscriptions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
