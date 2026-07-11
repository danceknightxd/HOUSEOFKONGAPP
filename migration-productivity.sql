-- ============================================================
-- THE THRONE — MIGRATION: Productivity Upgrade
-- Run this once in Supabase's SQL Editor. Safe to run on your
-- existing database — adds new columns/tables without touching
-- any data you already have.
-- ============================================================

alter table tasks add column if not exists due_date date;
alter table tasks add column if not exists recurrence text
  check (recurrence in ('none','daily','weekdays','weekly') or recurrence is null);

create table if not exists focus_sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  task_title text,
  duration_minutes int not null,
  completed_at timestamptz default now()
);

alter table focus_sessions enable row level security;

drop policy if exists "Users manage their own focus sessions" on focus_sessions;
create policy "Users manage their own focus sessions"
  on focus_sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter publication supabase_realtime add table focus_sessions;
