-- ============================================================
-- THE THRONE — FIX: Vault duplicate chambers + add delete
-- Run this alone in Supabase's SQL Editor.
--
-- Two problems, both in how chambers (vault_threads) get reused:
--
-- 1. The "find my existing chamber with this person" check used
--    .maybeSingle() in the app, which THROWS if more than one shared
--    chamber already exists between the same two people. That error
--    was silently swallowed, so the app fell through to creating yet
--    another chamber every time — compounding forever. Fixed on the
--    app side (sync.js); this migration cleans up the duplicates
--    that already piled up from it.
--
-- 2. There was no way to delete a chamber at all — no DELETE policy
--    existed on vault_threads.
-- ============================================================

-- ---------- 1. merge + remove duplicate chambers ----------
-- Groups chambers by their exact 2-person participant pair, keeps the
-- oldest chamber per pair, moves every message from the newer
-- duplicates into it, then deletes the duplicates (which cascades to
-- clean up their now-empty vault_participants rows automatically).
with thread_pairs as (
  select thread_id, array_agg(user_id order by user_id) as participants
  from vault_participants
  group by thread_id
  having count(*) = 2
),
ranked as (
  select tp.thread_id, tp.participants, vt.created_at,
         row_number() over (partition by tp.participants order by vt.created_at asc) as rn
  from thread_pairs tp
  join vault_threads vt on vt.id = tp.thread_id
),
canonical as (
  select participants, thread_id as keep_thread_id
  from ranked where rn = 1
),
duplicates as (
  select r.thread_id as dup_thread_id, c.keep_thread_id
  from ranked r
  join canonical c on c.participants = r.participants
  where r.rn > 1
)
update vault_messages m
set thread_id = d.keep_thread_id
from duplicates d
where m.thread_id = d.dup_thread_id;

with thread_pairs as (
  select thread_id, array_agg(user_id order by user_id) as participants
  from vault_participants
  group by thread_id
  having count(*) = 2
),
ranked as (
  select tp.thread_id, tp.participants, vt.created_at,
         row_number() over (partition by tp.participants order by vt.created_at asc) as rn
  from thread_pairs tp
  join vault_threads vt on vt.id = tp.thread_id
)
delete from vault_threads
where id in (select thread_id from ranked where rn > 1);

-- ---------- 2. allow either participant to delete a chamber ----------
-- Messages and participant rows cascade-delete automatically (both
-- already have "on delete cascade" back to vault_threads).
drop policy if exists "Participants can delete their threads" on vault_threads;
create policy "Participants can delete their threads"
  on vault_threads for delete
  using ( public.is_vault_participant(id, auth.uid()) );
