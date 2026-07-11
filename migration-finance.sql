-- ============================================================
-- THE THRONE — MIGRATION: Finance Upgrade (Pearler-inspired)
-- Run once in Supabase's SQL Editor. Safe on an existing database.
-- ============================================================

create table if not exists other_assets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  category text not null check (category in ('cash','property','super','other')),
  label text not null,
  value numeric not null default 0,
  updated_at timestamptz default now()
);
alter table other_assets enable row level security;
drop policy if exists "Users manage their own other assets" on other_assets;
create policy "Users manage their own other assets"
  on other_assets for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
alter publication supabase_realtime add table other_assets;

create table if not exists investment_plans (
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
drop policy if exists "Users manage their own investment plans" on investment_plans;
create policy "Users manage their own investment plans"
  on investment_plans for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
alter publication supabase_realtime add table investment_plans;

alter table profiles add column if not exists fi_annual_expenses numeric;
