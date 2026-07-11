-- ============================================================
-- THE THRONE — SUPABASE SCHEMA
-- Run this once in your Supabase project's SQL Editor
-- (Project → SQL Editor → New query → paste → Run)
-- ============================================================

-- ---------- profiles ----------
-- One row per user. Holds their public encryption key so others
-- can send them Vault messages only they can decrypt.
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,                     -- mirrored from auth.users so the app
                                   -- can look up contacts by email
  display_name text not null default 'Sovereign',
  public_key text,                -- base64 ECDH public key, generated client-side
  wrapped_private_key text,       -- private key, encrypted with a passphrase
                                   -- (client-side only) so a NEW device can
                                   -- restore the same identity instead of
                                   -- generating a separate one — see
                                   -- vault-crypto.js restoreFromBackup()
  key_salt text,                  -- PBKDF2 salt used to wrap the key above
  key_iv text,                    -- AES-GCM iv used to wrap the key above
  created_at timestamptz default now()
);

alter table profiles enable row level security;

create policy "Profiles are viewable by any signed-in user"
  on profiles for select
  using (auth.role() = 'authenticated');

create policy "Users can update their own profile"
  on profiles for update
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on profiles for insert
  with check (auth.uid() = id);

-- auto-create + keep the profile's email in sync with auth.users,
-- so a fresh sign-in already has a row to attach a public_key to
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, split_part(new.email, '@', 1))
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ---------- tasks ----------
create table tasks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  title text not null,
  priority text default 'med' check (priority in ('low','med','high')),
  done boolean default false,
  due_date date,
  recurrence text check (recurrence in ('none','daily','weekdays','weekly') or recurrence is null),
  created_at timestamptz default now()
);

alter table tasks enable row level security;

create policy "Users manage their own tasks"
  on tasks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ---------- focus_sessions ----------
-- Real time-tracking, RescueTime-style — powers the Dashboard's
-- Weekly Momentum bars with actual data instead of placeholders.
create table focus_sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  task_title text,
  duration_minutes int not null,
  completed_at timestamptz default now()
);

alter table focus_sessions enable row level security;

create policy "Users manage their own focus sessions"
  on focus_sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter publication supabase_realtime add table focus_sessions;


-- ---------- goals ----------
create table goals (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  title text not null,
  progress_pct int default 0 check (progress_pct between 0 and 100),
  meta text,                      -- e.g. "4 of 12 complete"
  created_at timestamptz default now()
);

alter table goals enable row level security;

create policy "Users manage their own goals"
  on goals for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ---------- fitness_logs ----------
create table fitness_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  metric text not null,           -- e.g. "squat", "steps", "sleep_hours"
  value numeric not null,
  logged_at timestamptz default now()
);

alter table fitness_logs enable row level security;

create policy "Users manage their own fitness logs"
  on fitness_logs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ---------- vault_threads ----------
-- A thread is just two (or more) participants. Kept separate from
-- messages so we can list "conversations" cheaply.
create table vault_threads (
  id uuid default gen_random_uuid() primary key,
  created_by uuid references auth.users on delete cascade not null,
  title text,
  created_at timestamptz default now()
);

alter table vault_threads enable row level security;

create table vault_participants (
  thread_id uuid references vault_threads on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  primary key (thread_id, user_id)
);

alter table vault_participants enable row level security;

create policy "Participants can see their threads"
  on vault_threads for select
  using (
    exists (
      select 1 from vault_participants
      where vault_participants.thread_id = vault_threads.id
      and vault_participants.user_id = auth.uid()
    )
  );

create policy "Users can create threads"
  on vault_threads for insert
  with check (auth.uid() = created_by);

create policy "Participants can see thread membership"
  on vault_participants for select
  using (
    exists (
      select 1 from vault_participants vp2
      where vp2.thread_id = vault_participants.thread_id
      and vp2.user_id = auth.uid()
    )
  );

create policy "Users can add participants to threads they created"
  on vault_participants for insert
  with check (
    exists (
      select 1 from vault_threads
      where vault_threads.id = thread_id
      and vault_threads.created_by = auth.uid()
    )
    or user_id = auth.uid()
  );


-- ---------- vault_messages ----------
-- ciphertext + iv are the ONLY things that touch the server.
-- Encryption/decryption happens entirely in the browser (see
-- vault-crypto.js) — Supabase and Anthropic never see plaintext.
create table vault_messages (
  id uuid default gen_random_uuid() primary key,
  thread_id uuid references vault_threads on delete cascade not null,
  sender_id uuid references auth.users on delete cascade not null,
  ciphertext text not null,       -- base64 AES-GCM ciphertext
  iv text not null,               -- base64 initialization vector
  created_at timestamptz default now()
);

alter table vault_messages enable row level security;

create policy "Participants can read messages in their threads"
  on vault_messages for select
  using (
    exists (
      select 1 from vault_participants
      where vault_participants.thread_id = vault_messages.thread_id
      and vault_participants.user_id = auth.uid()
    )
  );

create policy "Participants can send messages in their threads"
  on vault_messages for insert
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from vault_participants
      where vault_participants.thread_id = vault_messages.thread_id
      and vault_participants.user_id = auth.uid()
    )
  );

-- enable realtime on messages so new ones appear instantly
alter publication supabase_realtime add table vault_messages;
alter publication supabase_realtime add table tasks;
alter publication supabase_realtime add table goals;


-- ---------- workout_splits ----------
-- Your weekly training structure (Mon-Sun), separate from raw
-- fitness_logs metrics — this is "what's the plan" not "what happened".
create table workout_splits (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  day_of_week int not null check (day_of_week between 0 and 6), -- 0=Sun..6=Sat
  label text not null,            -- e.g. "PUSH", "LEGS", "REST"
  status text default 'upcoming' check (status in ('done','today','rest','upcoming')),
  week_start date not null default date_trunc('week', now())::date,
  created_at timestamptz default now()
);

alter table workout_splits enable row level security;

create policy "Users manage their own splits"
  on workout_splits for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter publication supabase_realtime add table workout_splits;


-- ---------- social_posts ----------
-- Manually-logged cross-posts for the Circle view. See README for why
-- this is manual entry rather than a live Instagram/Spotify auto-pull —
-- short version: Instagram's API requires a server-side token exchange
-- that can't be done safely from a purely client-side app.
create table social_posts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  platform text not null check (platform in ('instagram','spotify','other')),
  caption text,
  link text,
  image_url text,
  posted_at timestamptz default now()
);

alter table social_posts enable row level security;

create policy "Users manage their own social posts"
  on social_posts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter publication supabase_realtime add table social_posts;


-- ---------- news_topics ----------
-- User-typed custom topics (e.g. "soccer"), on top of the starter set
-- in config.js. Powers Google News RSS search — no API key needed.
create table news_topics (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  rss_url text not null,
  enabled boolean default true,
  created_at timestamptz default now()
);

alter table news_topics enable row level security;

create policy "Users manage their own news topics"
  on news_topics for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter publication supabase_realtime add table news_topics;


-- ---------- portfolio_holdings ----------
-- Crypto uses CoinGecko IDs (free, no API key). Stocks need a symbol +
-- a configured stock API key client-side — see market-config.js.
create table portfolio_holdings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  asset_type text not null check (asset_type in ('crypto','stock')),
  symbol text not null,           -- e.g. "bitcoin" (CoinGecko id) or "AAPL"
  label text,                     -- display name, e.g. "Bitcoin"
  quantity numeric not null default 0,
  created_at timestamptz default now()
);

alter table portfolio_holdings enable row level security;

create policy "Users manage their own portfolio"
  on portfolio_holdings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter publication supabase_realtime add table portfolio_holdings;


-- ---------- alliances ----------
-- A friends list. Sending a request creates one row; accepting just
-- flips its status — no duplicate row on the other side needed since
-- policies check both directions.
create table alliances (
  id uuid default gen_random_uuid() primary key,
  requester_id uuid references auth.users on delete cascade not null,
  recipient_id uuid references auth.users on delete cascade not null,
  status text default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz default now(),
  unique(requester_id, recipient_id)
);

alter table alliances enable row level security;

create policy "Users see alliances they're part of"
  on alliances for select
  using (auth.uid() = requester_id or auth.uid() = recipient_id);

create policy "Users can send alliance requests"
  on alliances for insert
  with check (auth.uid() = requester_id);

create policy "Recipients can respond, either side can update"
  on alliances for update
  using (auth.uid() = requester_id or auth.uid() = recipient_id);

create policy "Either side can remove an alliance"
  on alliances for delete
  using (auth.uid() = requester_id or auth.uid() = recipient_id);

alter publication supabase_realtime add table alliances;


-- ---------- other_assets ----------
-- Pearler's most-praised feature is showing TRUE net worth — not just
-- investments, but cash, property, super, everything. This is that.
create table other_assets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  category text not null check (category in ('cash','property','super','other')),
  label text not null,
  value numeric not null default 0,
  updated_at timestamptz default now()
);

alter table other_assets enable row level security;

create policy "Users manage their own other assets"
  on other_assets for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter publication supabase_realtime add table other_assets;


-- ---------- investment_plans ----------
-- Pearler's "Autoinvest" — recurring contribution planning. This is a
-- planning/reminder tool, NOT real trade execution (that needs a
-- licensed broker integration, well beyond a self-hosted app) — logging
-- a contribution here manually updates the linked holding's quantity.
create table investment_plans (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  label text not null,
  holding_id uuid references portfolio_holdings on delete set null,
  amount numeric not null,
  frequency text not null check (frequency in ('weekly','fortnightly','monthly')),
  next_due date not null,
  created_at timestamptz default now()
);

alter table investment_plans enable row level security;

create policy "Users manage their own investment plans"
  on investment_plans for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter publication supabase_realtime add table investment_plans;


-- ---------- FI tracking ----------
alter table profiles add column if not exists fi_annual_expenses numeric;


-- ---------- budget_envelopes (Goodbudget-style, manual — no bank link needed) ----------
create table budget_envelopes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  label text not null,
  monthly_budget numeric not null default 0,
  created_at timestamptz default now()
);
alter table budget_envelopes enable row level security;
create policy "Users manage their own envelopes"
  on budget_envelopes for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
alter publication supabase_realtime add table budget_envelopes;

create table envelope_expenses (
  id uuid default gen_random_uuid() primary key,
  envelope_id uuid references budget_envelopes on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  amount numeric not null,
  note text,
  logged_at timestamptz default now()
);
alter table envelope_expenses enable row level security;
create policy "Users manage their own envelope expenses"
  on envelope_expenses for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
alter publication supabase_realtime add table envelope_expenses;


-- ---------- bills (GetReminded-style recurring bill tracking) ----------
create table bills (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  label text not null,
  amount numeric not null,
  due_day int not null check (due_day between 1 and 31),
  category text default 'other',
  last_paid date,
  created_at timestamptz default now()
);
alter table bills enable row level security;
create policy "Users manage their own bills"
  on bills for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
alter publication supabase_realtime add table bills;


-- ---------- savings_goals (Frollo/WeMoney-style, dollar-based) ----------
create table savings_goals (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  label text not null,
  target_amount numeric not null,
  current_amount numeric not null default 0,
  target_date date,
  created_at timestamptz default now()
);
alter table savings_goals enable row level security;
create policy "Users manage their own savings goals"
  on savings_goals for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
alter publication supabase_realtime add table savings_goals;


-- ---------- exercise_logs ----------
-- Real per-exercise logging (sets/reps/weight/RPE), not just a single
-- daily metric — the thing Boostcamp/Strong/Caliber all do well and
-- our old generic fitness_logs metric didn't capture properly.
create table exercise_logs (
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

create policy "Users manage their own exercise logs"
  on exercise_logs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter publication supabase_realtime add table exercise_logs;


-- ---------- push_subscriptions ----------
-- Real browser/OS push notifications (Messenger-style), not email.
-- Each device that enables notifications gets its own subscription row.
create table push_subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  created_at timestamptz default now()
);

alter table push_subscriptions enable row level security;

create policy "Users manage their own push subscriptions"
  on push_subscriptions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
