-- ============================================================
-- THE THRONE — FIX: Infinite recursion in vault_participants policy
-- Run this alone in Supabase's SQL Editor.
--
-- The problem: the original policy checked "can this user see this
-- row?" by querying vault_participants itself — which re-triggers
-- the same policy check, forever.
--
-- The fix: a SECURITY DEFINER function checks membership with the
-- function owner's privileges (bypassing RLS internally), so the
-- policy can call it without triggering itself again.
-- ============================================================

create or replace function public.is_vault_participant(_thread_id uuid, _user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from vault_participants
    where thread_id = _thread_id and user_id = _user_id
  );
$$;

drop policy if exists "Participants can see thread membership" on vault_participants;
create policy "Participants can see thread membership"
  on vault_participants for select
  using ( public.is_vault_participant(thread_id, auth.uid()) );
