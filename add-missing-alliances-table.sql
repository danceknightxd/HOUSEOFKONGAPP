-- ============================================================
-- THE THRONE — ADD MISSING TABLE: alliances
-- Run this alone in Supabase's SQL Editor if the alliances table
-- is missing from Table Editor. Safe to run even if some of this
-- partially exists — every statement below either creates
-- something new or safely replaces a policy.
-- ============================================================

create table if not exists alliances (
  id uuid default gen_random_uuid() primary key,
  requester_id uuid references auth.users on delete cascade not null,
  recipient_id uuid references auth.users on delete cascade not null,
  status text default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz default now(),
  unique(requester_id, recipient_id)
);

alter table alliances enable row level security;

drop policy if exists "Users see alliances they're part of" on alliances;
create policy "Users see alliances they're part of"
  on alliances for select
  using (auth.uid() = requester_id or auth.uid() = recipient_id);

drop policy if exists "Users can send alliance requests" on alliances;
create policy "Users can send alliance requests"
  on alliances for insert
  with check (auth.uid() = requester_id);

drop policy if exists "Recipients can respond, either side can update" on alliances;
create policy "Recipients can respond, either side can update"
  on alliances for update
  using (auth.uid() = requester_id or auth.uid() = recipient_id);

drop policy if exists "Either side can remove an alliance" on alliances;
create policy "Either side can remove an alliance"
  on alliances for delete
  using (auth.uid() = requester_id or auth.uid() = recipient_id);

-- enable realtime updates for this table (safe to ignore the error
-- below if it says "already a member" — that just means this part
-- already worked)
alter publication supabase_realtime add table alliances;
