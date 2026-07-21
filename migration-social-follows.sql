-- ============================================================
-- THE THRONE — MIGRATION: Social Follows (YouTube channels + X accounts)
-- Run once in Supabase's SQL Editor. Safe on an existing database.
-- Backs the new YouTube and X/Twitter feed sections under Your Feed —
-- one shared table since "a source whose latest items I always want
-- to see" is the same shape whether it's a YouTube channel or an X
-- account.
-- ============================================================

create table if not exists social_follows (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  platform text not null check (platform in ('youtube','x')),
  identifier text not null, -- YouTube: channel ID (UC...) or @handle. X: @handle (no @).
  label text,
  created_at timestamptz default now(),
  unique(user_id, platform, identifier)
);
alter table social_follows enable row level security;
drop policy if exists "Users manage their own social follows" on social_follows;
create policy "Users manage their own social follows"
  on social_follows for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
alter publication supabase_realtime add table social_follows;
