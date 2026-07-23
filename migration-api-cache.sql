-- ============================================================
-- THE THRONE — MIGRATION: API Cache
-- Run once in Supabase's SQL Editor. Safe on an existing database.
--
-- Backs the new data-proxy Edge Function. Instead of every device
-- calling CoinGecko/Twelve Data/YouTube/etc directly (each call
-- subject to that provider's own rate limits, and a hard failure if
-- that provider has a bad day — which has already happened twice
-- this build), the proxy checks here first and only calls the real
-- API when the cached entry is missing or stale.
-- ============================================================

create table if not exists api_cache (
  cache_key text primary key,
  data jsonb not null,
  fetched_at timestamptz not null default now()
);

-- No RLS — this table holds no user data, just shared API responses
-- (crypto prices, video lists, etc). Every user benefits from the
-- same cached entry for the same key, so it's intentionally not
-- scoped per-user.
alter table api_cache enable row level security;
drop policy if exists "Anyone can read the shared cache" on api_cache;
create policy "Anyone can read the shared cache"
  on api_cache for select using (true);
-- Only the service role (used by the Edge Function, not the client)
-- can write — regular users can read cached data but never write
-- directly into the cache table themselves.
