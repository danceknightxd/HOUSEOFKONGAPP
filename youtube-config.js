/* ============================================================
   THE THRONE — YOUTUBE CONFIG
   Two different YouTube features here, and only one of them needs a key:

   - Following a CHANNEL's latest videos works with NO key at all —
     it uses YouTube's own public RSS feed for the channel (same trick
     config.js's bloggerFeeds use for Blogger). Paste a channel ID
     (starts with "UC...") to follow one this way.

   - Searching by TOPIC has no keyless equivalent — YouTube doesn't
     publish a "search results as RSS" feed, so this needs the real
     YouTube Data API v3. Free tier: 10,000 "units" per day, and a
     search costs 100 units — so about 100 searches/day before you'd
     hit the daily cap. Get a free key: 
     https://console.cloud.google.com/apis/credentials
     (enable "YouTube Data API v3" on the project first)
   ============================================================ */

const YOUTUBE_CONFIG = {
  apiKey: "AIzaSyBekglgwroaehIyCbQOFj8Tjs_yKcBQEP4" // optional — only needed for topic search, not for following a channel
};
