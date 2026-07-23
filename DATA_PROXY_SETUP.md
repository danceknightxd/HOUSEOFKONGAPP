# Data Proxy — Setup Guide

Every external API call in the app (crypto/stock prices, YouTube,
OpenSea, news RSS) now routes through one Edge Function
(`data-proxy.ts`) instead of calling those providers directly from
the browser. Two reasons this exists:

1. **Reliability.** A provider having a bad day used to take down
   the whole feature with a hard error — this happened twice already
   (rss2json's undocumented count cap, YouTube's own RSS feed's
   ongoing reliability problems). The proxy caches every response and
   falls back to the last-known value if the live call fails, instead
   of erroring outright.
2. **Keys off the client.** API keys previously sat in plain client
   config files, visible to anyone who opened dev tools. They're now
   Edge Function secrets instead — genuinely hidden.

---

## 1. Run the migration

In Supabase's SQL Editor, run `migration-api-cache.sql` — creates
the shared cache table the proxy reads and writes.

## 2. Deploy the function

**Dashboard (no install required):**
1. Supabase Dashboard → **Edge Functions** → **Deploy a new function** → **Via Editor**.
2. Name it exactly `data-proxy`.
3. Delete the template code, paste in the full contents of `data-proxy.ts`.
4. **Deploy function**.

**Or via CLI:**
```bash
supabase functions deploy data-proxy
```

## 3. Set your secrets

Only add the ones you actually use — everything works without stock
data or YouTube if you skip those.

**Dashboard:** Edge Functions → Manage → Secrets:

| Name | Needed for | Get one at |
|---|---|---|
| `TWELVEDATA_API_KEY` | Stock prices/charts | twelvedata.com (free, 800 req/day) |
| `YOUTUBE_API_KEY` | King's Colosseum, Your Feed's YouTube panel | console.cloud.google.com (free, 10,000 units/day) |
| `OPENSEA_API_KEY` | King's Art Exhibitions | Optional — works without one at low volume |
| `RSS2JSON_API_KEY` | News feed | Optional — works without one, capped at 10 items/request |

**Or CLI:** `supabase secrets set TWELVEDATA_API_KEY=your-key-here` (repeat per key).

## 4. Flip the local flags

Two client config files just hold a boolean now instead of the real
key — set these once your secrets are live:

- `market-config.js` → `stocksConfigured: true`
- `youtube-config.js` → `configured: true`

## 5. Swap in the updated client files

`markets.js`, `kings.js`, `social-feeds.js`, and the new
`data-proxy-client.js` all need to be in place together — they're
what actually calls the proxy instead of the old direct API calls.
`market-config.js` and `youtube-config.js` are replaced too (old
versions held the real keys; new versions just hold the flags above).

## Notes

- **Cache freshness varies by data type** — prices refresh every
  minute, video/collection data every 10–15 minutes. Defined in
  `data-proxy.ts`'s `TTL_SECONDS` if you want to tune it.
- **The cache table has no per-user data** in it — it's shared
  across everyone using your instance (fine for a single-user or
  small-group self-hosted app; if you ever open this up more broadly,
  revisit that).
- **Debugging:** Edge Functions → data-proxy → Logs shows every call,
  including which ones hit cache vs. went upstream.
