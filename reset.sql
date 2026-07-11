-- ============================================================
-- THE THRONE — RESET SCRIPT
-- Run this ONLY if you need to wipe and re-run schema.sql from
-- scratch (e.g. a partial run left some tables behind). This
-- deletes all data in these tables — there's no undo.
-- ============================================================

drop table if exists vault_messages cascade;
drop table if exists vault_participants cascade;
drop table if exists vault_threads cascade;
drop table if exists portfolio_holdings cascade;
drop table if exists news_topics cascade;
drop table if exists social_posts cascade;
drop table if exists workout_splits cascade;
drop table if exists fitness_logs cascade;
drop table if exists goals cascade;
drop table if exists tasks cascade;
drop table if exists profiles cascade;

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
