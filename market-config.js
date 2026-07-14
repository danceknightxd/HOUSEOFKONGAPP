/* ============================================================
   THE THRONE — MARKET CONFIG
   Crypto prices/charts use CoinGecko's free public API — no key,
   no signup, works immediately.

   Stock prices need a key because free no-key stock APIs don't
   really exist anymore. Twelve Data's free tier (800 requests/day)
   is the easiest: sign up at https://twelvedata.com, grab an API
   key, paste it below. Leave it blank and stock holdings will show
   a clear "add a key" message instead of fake data.
   ============================================================ */

const MARKET_CONFIG = {
  twelveDataApiKey: "CG-MHByXoXAnKuzuNxG3LuwJWJM", // optional — only needed for stock holdings

  // A handful of headline tickers shown on the Markets dashboard by
  // default, even before you add a personal portfolio.
  watchlist: {
    crypto: ["bitcoin", "ethereum", "solana"],   // CoinGecko ids
    stocks: ["AAPL", "MSFT", "NVDA"]             // needs twelveDataApiKey
  }
};
