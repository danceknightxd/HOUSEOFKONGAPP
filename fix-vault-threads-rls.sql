-- ============================================================
-- THE THRONE — FIX: vault_threads RLS blocking new thread creation
-- Run this alone in Supabase's SQL Editor.
--
-- The problem: creating a thread inserts the row, then immediately
-- tries to read it back. But at that exact instant, no participant
-- row exists yet (that's added in a separate step right after) —
-- so the "can you see this thread?" policy said no, and the whole
-- create-a-chamber flow failed.
--
-- The fix: let the creator see their own thread immediately, in
-- addition to the existing participant-based access.
-- ============================================================

drop policy if exists "Participants can see their threads" on vault_threads;
create policy "Participants can see their threads"
  on vault_threads for select
  using (
    created_by = auth.uid()
    or exists (
      select 1 from vault_participants
      where vault_participants.thread_id = vault_threads.id
      and vault_participants.user_id = auth.uid()
    )
  );
