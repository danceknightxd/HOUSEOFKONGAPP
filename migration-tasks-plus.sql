-- ============================================================
-- THE THRONE — MIGRATION: Tasks+ (Personal Bests view, Time-Blocking,
-- Monthly Calendar, Reminder Alerts). Run once in Supabase's SQL
-- Editor. Safe on an existing database.
--
-- Personal Bests and the Monthly Calendar read from tables you
-- already have (exercise_logs, tasks) — no new tables needed for
-- those two. This migration only adds what's new: reminder fields
-- on tasks, and a table for standalone time blocks.
-- ============================================================

alter table tasks add column if not exists reminder_at timestamptz;
alter table tasks add column if not exists reminder_sent boolean not null default false;

create table if not exists time_blocks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  label text not null,
  day date not null,
  start_minutes int not null check (start_minutes >= 0 and start_minutes < 1440), -- minutes since midnight
  duration_minutes int not null default 60 check (duration_minutes > 0),
  color text,
  created_at timestamptz default now()
);
alter table time_blocks enable row level security;
drop policy if exists "Users manage their own time blocks" on time_blocks;
create policy "Users manage their own time blocks"
  on time_blocks for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
alter publication supabase_realtime add table time_blocks;

-- ---------- Reminder alerts: scheduled check ----------
-- The notify-task-reminder Edge Function (see TASK_REMINDERS_SETUP.md)
-- needs something to call it on a schedule — it can't fire itself.
-- Easiest path: Supabase Dashboard → Database → Cron Jobs → new job
-- that HTTP-POSTs the function's URL every minute. That needs no SQL
-- at all, so it's not included here.
--
-- If you'd rather do it in SQL instead of the dashboard, this is the
-- pg_cron equivalent (uncomment and fill in the two placeholders —
-- your project ref and your anon public key, both from Project
-- Settings → API):
--
-- create extension if not exists pg_cron;
-- create extension if not exists pg_net;
-- select cron.schedule(
--   'task-reminder-check',
--   '* * * * *', -- every minute
--   $$
--   select net.http_post(
--     url := 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/notify-task-reminder',
--     headers := jsonb_build_object('Authorization', 'Bearer YOUR-ANON-PUBLIC-KEY')
--   );
--   $$
-- );
