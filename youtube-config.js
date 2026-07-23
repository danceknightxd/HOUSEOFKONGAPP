/* ============================================================
   THE THRONE — YOUTUBE CONFIG
   The actual API key no longer lives here — every YouTube call
   (King's Colosseum, following a channel, topic search) now routes
   through the data-proxy Edge Function, which holds the real key
   server-side as a secret (YOUTUBE_API_KEY) instead of in client
   code. This file just flips a local switch once that's set up, the
   same way market-config.js does for the stock data key.

   Get a free key:
   1. https://console.cloud.google.com/apis/credentials
   2. Enable "YouTube Data API v3" first (APIs & Services → Library
      → search it → Enable)
   3. Create a key under Credentials
   4. Set it as an Edge Function secret: supabase secrets set
      YOUTUBE_API_KEY=your-key-here (or via the dashboard, same as
      any other Edge Function secret)
   5. Set configured: true below

   Free tier: 10,000 units/day. A channel refresh costs ~2 units, a
   topic search costs 100 — same limits as before, just enforced
   server-side now instead of the key sitting in this file.
   ============================================================ */

const YOUTUBE_CONFIG = {
  configured: false
};
