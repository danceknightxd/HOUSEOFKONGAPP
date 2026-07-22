/* ============================================================
   THE THRONE — YOUTUBE CONFIG
   One key powers every YouTube feature in the app (King's Colosseum,
   following a channel, and searching by topic under Your Feed).

   An earlier version of this tried to make channel-follows keyless
   via YouTube's own RSS feed — that route turned out to be
   unreliable (YouTube's RSS endpoint has ongoing, widely-reported
   intermittent failures, independent of anything in this app), so
   everything now goes through the real YouTube Data API v3 instead,
   consistently. One key, one setup step, works everywhere.

   Get a free key:
   1. https://console.cloud.google.com/apis/credentials
   2. Enable "YouTube Data API v3" on the project first (APIs & Services
      → Library → search "YouTube Data API v3" → Enable)
   3. Create a key under Credentials → paste it below

   Free tier: 10,000 "units" per day.
   - Following a channel costs ~2 units per refresh (very cheap —
     thousands of refreshes/day before you'd notice).
   - A topic search costs 100 units — about 100 searches/day max.
   King's Colosseum, channel follows, and topic search all draw from
   this same daily quota, so heavy topic-search use is the only way
   you'd realistically hit the cap.
   ============================================================ */

const YOUTUBE_CONFIG = {
  apiKey: ""
};
