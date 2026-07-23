/* ============================================================
   THE THRONE — MARKETS ENGINE
   Crypto and stock data both route through the data-proxy Edge
   Function now (see data-proxy.ts) instead of calling CoinGecko/
   Twelve Data directly — the proxy caches responses and serves the
   last-known value if a provider is having a bad day, instead of a
   hard failure. Twelve Data's key lives server-side as a secret now
   too (see market-config.js).
   ============================================================ */

const ThroneMarkets = (() => {

  function hasStockKey() {
    return !!(typeof MARKET_CONFIG !== "undefined" && MARKET_CONFIG.stocksConfigured);
  }

  // ---------- crypto ----------
  async function getCryptoPrices(ids, currency = "usd") {
    if (!ids.length) return {};
    try {
      const res = await ThroneProxy.call("crypto_price", { ids, currency });
      return res.data;
    } catch (e) {
      return {}; // matches prior behavior's shape on failure — callers already handle empty
    }
  }

  async function getCryptoChart(id, days = 7, currency = "usd") {
    try {
      const res = await ThroneProxy.call("crypto_chart", { id, days, currency });
      return res.data;
    } catch (e) {
      return [];
    }
  }

  // ---------- stocks (needs TWELVEDATA_API_KEY set server-side) ----------
  async function getStockPrices(symbols) {
    if (!hasStockKey() || !symbols.length) return {};
    try {
      const res = await ThroneProxy.call("stock_price", { symbols });
      return res.data;
    } catch (e) {
      return {};
    }
  }

  async function getStockChart(symbol, interval = "1day", outputsize = 30) {
    if (!hasStockKey()) return [];
    try {
      const res = await ThroneProxy.call("stock_chart", { symbol, interval, outputsize });
      return res.data;
    } catch (e) {
      return [];
    }
  }

  return { getCryptoPrices, getCryptoChart, getStockPrices, getStockChart, hasStockKey };
})();
