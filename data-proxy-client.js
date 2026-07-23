/* ============================================================
   THE THRONE — DATA PROXY CLIENT
   Thin wrapper every feature that needs external data now calls
   through, instead of hitting CoinGecko/Twelve Data/YouTube/etc
   directly. The Edge Function on the other end caches responses and
   falls back to stale data instead of a hard error when a provider
   is having a bad day — see data-proxy.ts and migration-api-cache.sql.
   ============================================================ */

const ThroneProxy = (() => {
  async function call(domain, params) {
    const { data, error } = await supabaseClient.functions.invoke("data-proxy", {
      body: { domain, params }
    });
    if (error) throw error;
    if (data && data.error) throw new Error(data.error);
    return data; // { data, stale, cached }
  }
  return { call };
})();
