/* ============================================================
   THE THRONE — MARKET CONFIG
   Crypto prices/charts use CoinGecko's free public API — no key,
   no signup, works immediately.

   Stock prices need a Twelve Data key, but it no longer lives here —
   all external API calls (crypto, stocks, YouTube, OpenSea, news)
   now go through a server-side proxy (data-proxy.ts) that caches
   responses and keeps API keys out of client code entirely. Set
   TWELVEDATA_API_KEY as an Edge Function secret (free tier, 800
   requests/day: https://twelvedata.com), then flip the flag below
   so the app knows to actually try — it can't check a server secret
   directly, so this is just a local "yes, I've set it up" switch.
   ============================================================ */

const MARKET_CONFIG = {
  stocksConfigured: false, // set true once TWELVEDATA_API_KEY is set server-side

  // A handful of headline tickers shown on the Markets dashboard by
  // default, even before you add a personal portfolio.
  watchlist: {
    crypto: ["bitcoin", "ethereum", "solana"],   // CoinGecko ids
    stocks: ["AAPL", "MSFT", "NVDA"]             // needs stocksConfigured
  }
};
