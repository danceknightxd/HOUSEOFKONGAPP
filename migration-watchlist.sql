-- ============================================================
-- THE THRONE — MIGRATION: Editable Watchlist + Portfolio Amendments
-- Run once in Supabase's SQL Editor. Safe on an existing database.
-- ============================================================

create table if not exists watchlist_items (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  asset_type text not null check (asset_type in ('crypto','stock')),
  symbol text not null,
  label text,
  created_at timestamptz default now()
);
alter table watchlist_items enable row level security;
drop policy if exists "Users manage their own watchlist" on watchlist_items;
create policy "Users manage their own watchlist"
  on watchlist_items for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
alter publication supabase_realtime add table watchlist_items;

alter table portfolio_holdings add column if not exists avg_price numeric;

alter table tasks add column if not exists completed_at timestamptz;

alter table vault_messages add column if not exists read_at timestamptz;
