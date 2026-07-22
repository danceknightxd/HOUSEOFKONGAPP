-- ============================================================
-- THE THRONE — MIGRATION: Social Follows (consolidated)
-- Run once in Supabase's SQL Editor. Safe regardless of whether
-- you've run any earlier version of this migration before —
-- creates the table fresh if it doesn't exist yet, or fixes it up
-- if an older version does exist.
--
-- Backs the YouTube feed under Your Feed: followed channels and
-- persistent topic chips, both stored here (same shape, so one
-- table covers both — a 'platform' column tells them apart).
-- ============================================================

create table if not exists social_follows (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  platform text not null,
  identifier text not null, -- channel ID (UC...), @handle, or a topic string
  label text,
  created_at timestamptz default now(),
  unique(user_id, platform, identifier)
);

alter table social_follows enable row level security;
drop policy if exists "Users manage their own social follows" on social_follows;
create policy "Users manage their own social follows"
  on social_follows for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- realtime — safe to ignore an "already a member" error here, that
-- just means this part already worked on an earlier run
alter publication supabase_realtime add table social_follows;

-- Drop any old 'x' rows from an earlier attempt, and make sure the
-- constraint only allows what the app actually uses now.
delete from social_follows where platform = 'x';
alter table social_follows drop constraint if exists social_follows_platform_check;
alter table social_follows add constraint social_follows_platform_check
  check (platform in ('youtube','youtube-topic'));
