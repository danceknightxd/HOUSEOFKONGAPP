/* ============================================================
   THE THRONE — MARKETS ENGINE
   Crypto: CoinGecko public API, free, no key, no signup.
   Stocks: Twelve Data, free tier, needs a key (see market-config.js).
   ============================================================ */

const ThroneMarkets = (() => {

  const COINGECKO = "https://api.coingecko.com/api/v3";
  const TWELVEDATA = "https://api.twelvedata.com";

  // ---------- crypto ----------
  async function getCryptoPrices(ids) {
    if (!ids.length) return {};
    const url = `${COINGECKO}/simple/price?ids=${ids.join(",")}&vs_currencies=usd&include_24hr_change=true`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("CoinGecko request failed");
    return res.json(); // { bitcoin: { usd: 67000, usd_24h_change: 2.1 }, ... }
  }

  async function getCryptoChart(id, days = 7) {
    const url = `${COINGECKO}/coins/${id}/market_chart?vs_currency=usd&days=${days}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("CoinGecko chart request failed");
    const data = await res.json();
    return data.prices.map(([ts, price]) => ({ t: ts, y: price })); // [{t,y}, ...]
  }

  // ---------- stocks (needs a Twelve Data key) ----------
  function hasStockKey() {
    return !!(MARKET_CONFIG.twelveDataApiKey && MARKET_CONFIG.twelveDataApiKey.trim());
  }

  async function getStockPrices(symbols) {
    if (!hasStockKey() || !symbols.length) return {};
    const url = `${TWELVEDATA}/quote?symbol=${symbols.join(",")}&apikey=${MARKET_CONFIG.twelveDataApiKey}`;
    const res = await fetch(url);
    const data = await res.json();
    // Twelve Data returns a single object for one symbol, or {symbol: {...}} for many
    if (symbols.length === 1) return { [symbols[0]]: data };
    return data;
  }

  async function getStockChart(symbol, interval = "1day", outputsize = 30) {
    if (!hasStockKey()) return [];
    const url = `${TWELVEDATA}/time_series?symbol=${symbol}&interval=${interval}&outputsize=${outputsize}&apikey=${MARKET_CONFIG.twelveDataApiKey}`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.values) return [];
    return data.values.reverse().map(v => ({ t: new Date(v.datetime).getTime(), y: parseFloat(v.close) }));
  }

  return { getCryptoPrices, getCryptoChart, getStockPrices, getStockChart, hasStockKey };
})();
