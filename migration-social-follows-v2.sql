-- ============================================================
-- THE THRONE — MIGRATION: Social Follows v2
-- Run once in Supabase's SQL Editor. Safe on an existing database.
--
-- Two changes:
-- 1. Removes X/Twitter support entirely — X's API has no free tier,
--    so that feed panel has been removed from the app. Deletes any
--    'x' rows that exist (there likely aren't any, since the feature
--    was brand new) and narrows the constraint accordingly.
-- 2. Adds 'youtube-topic' as a platform value, alongside the existing
--    'youtube' (channel follows) — this is what backs the new
--    persistent topic chips (same pattern News already uses for its
--    custom topic chips), stored in the same table rather than a
--    separate one since the shape is identical.
-- ============================================================

delete from social_follows where platform = 'x';

alter table social_follows drop constraint if exists social_follows_platform_check;
alter table social_follows add constraint social_follows_platform_check
  check (platform in ('youtube','youtube-topic'));
