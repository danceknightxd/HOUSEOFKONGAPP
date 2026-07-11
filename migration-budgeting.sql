-- ============================================================
-- THE THRONE — MIGRATION: Budgeting Upgrade (Goodbudget/GetReminded/
-- Frollo-inspired). Run once in Supabase's SQL Editor. Safe on an
-- existing database.
-- ============================================================

create table if not exists budget_envelopes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  label text not null,
  monthly_budget numeric not null default 0,
  created_at timestamptz default now()
);
alter table budget_envelopes enable row level security;
drop policy if exists "Users manage their own envelopes" on budget_envelopes;
create policy "Users manage their own envelopes"
  on budget_envelopes for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
alter publication supabase_realtime add table budget_envelopes;

create table if not exists envelope_expenses (
  id uuid default gen_random_uuid() primary key,
  envelope_id uuid references budget_envelopes on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  amount numeric not null,
  note text,
  logged_at timestamptz default now()
);
alter table envelope_expenses enable row level security;
drop policy if exists "Users manage their own envelope expenses" on envelope_expenses;
create policy "Users manage their own envelope expenses"
  on envelope_expenses for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
alter publication supabase_realtime add table envelope_expenses;

create table if not exists bills (
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
drop policy if exists "Users manage their own bills" on bills;
create policy "Users manage their own bills"
  on bills for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
alter publication supabase_realtime add table bills;

create table if not exists savings_goals (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  label text not null,
  target_amount numeric not null,
  current_amount numeric not null default 0,
  target_date date,
  created_at timestamptz default now()
);
alter table savings_goals enable row level security;
drop policy if exists "Users manage their own savings goals" on savings_goals;
create policy "Users manage their own savings goals"
  on savings_goals for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
alter publication supabase_realtime add table savings_goals;
