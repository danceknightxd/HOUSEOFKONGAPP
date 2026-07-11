-- ============================================================
-- THE THRONE — MIGRATION: Fitness Upgrade (Boostcamp/Strong/Caliber-
-- inspired real workout logging). Run once in Supabase's SQL Editor.
-- Safe on an existing database.
-- ============================================================

create table if not exists exercise_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  exercise_name text not null,
  weight numeric not null,
  reps int not null,
  sets int not null default 1,
  rpe numeric check (rpe is null or (rpe >= 1 and rpe <= 10)),
  logged_at timestamptz default now()
);
alter table exercise_logs enable row level security;
drop policy if exists "Users manage their own exercise logs" on exercise_logs;
create policy "Users manage their own exercise logs"
  on exercise_logs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
alter publication supabase_realtime add table exercise_logs;
