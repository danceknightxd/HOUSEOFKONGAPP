// ============================================================
// THE THRONE — DATA PROXY (Supabase Edge Function)
// One function fronting every third-party API this app calls, so a
// single provider having a bad day (rate limit, outage, format
// change) degrades gracefully instead of breaking a whole feature —
// this happened twice already: rss2json's undocumented count cap,
// and YouTube's own RSS feed's ongoing reliability problems.
//
// How it works:
// 1. Client sends { domain, params } — never calls the real API directly.
// 2. Check api_cache for a fresh entry (TTL depends on domain — prices
//    move fast, video lists don't).
// 3. Fresh cache hit -> return it immediately, zero upstream calls.
// 4. Stale or missing -> call the real API.
//    - Success -> save to cache, return it.
//    - Failure -> if a stale cached entry exists, return THAT instead
//      of erroring (marked stale: true so the client can show it was
//      last real data, not live) — only error outright if there's
//      truly nothing cached yet.
//
// Secrets this function needs (same keys, now server-side instead of
// in client config files — also closes the "key sitting in page
// source" issue for the ones that matter):
//   TWELVEDATA_API_KEY, YOUTUBE_API_KEY, OPENSEA_API_KEY (optional),
//   RSS2JSON_API_KEY (optional)
// ============================================================

const TTL_SECONDS = {
  crypto_price: 60,          // moves fast
  crypto_chart: 300,
  stock_price: 60,
  stock_chart: 300,
  youtube_channel: 900,      // 15 min — videos don't post that often
  youtube_search: 900,
  youtube_resolve_handle: 86400, // channel IDs never change once resolved
  opensea_stats: 600,
  news_rss: 600
};

Deno.serve(async (req) => {
  try {
    const { createClient } = await import("npm:@supabase/supabase-js@2");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL"),
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    );

    const { domain, params } = await req.json();
    if (!domain || !TTL_SECONDS[domain]) {
      return json({ error: "Unknown or missing domain." });
    }

    const cacheKey = domain + ":" + JSON.stringify(params || {});
    const ttl = TTL_SECONDS[domain];

    const { data: cached } = await supabase
      .from("api_cache").select("data, fetched_at").eq("cache_key", cacheKey).maybeSingle();

    const isFresh = cached && (Date.now() - new Date(cached.fetched_at).getTime()) < ttl * 1000;
    if (isFresh) {
      return json({ data: cached.data, stale: false, cached: true });
    }

    let fresh;
    try {
      fresh = await fetchUpstream(domain, params || {});
    } catch (upstreamErr) {
      // Upstream failed — fall back to whatever's cached, however old,
      // rather than a hard error. Better a slightly stale price than
      // a broken panel.
      if (cached) {
        return json({ data: cached.data, stale: true, cached: true, upstreamError: upstreamErr.message });
      }
      return json({ error: upstreamErr.message });
    }

    // Log the live call for the "API Usage Today" panel — only real
    // upstream calls count here, cache hits above never reach this line.
    supabase.from("api_usage_log").insert({ domain }).then(() => {}, () => {});

    await supabase.from("api_cache").upsert({
      cache_key: cacheKey, data: fresh, fetched_at: new Date().toISOString()
    });

    return json({ data: fresh, stale: false, cached: false });
  } catch (e) {
    return json({ error: e.message });
  }
});

function json(body) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
}

async function fetchUpstream(domain, params) {
  switch (domain) {
    case "crypto_price": {
      const ids = params.ids.join(",");
      const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=${params.currency || "usd"}&include_24hr_change=true`);
      if (!res.ok) throw new Error("CoinGecko request failed");
      return res.json();
    }
    case "crypto_chart": {
      const res = await fetch(`https://api.coingecko.com/api/v3/coins/${params.id}/market_chart?vs_currency=${params.currency || "usd"}&days=${params.days || 7}`);
      if (!res.ok) throw new Error("CoinGecko chart request failed");
      const d = await res.json();
      return d.prices.map(([t, y]) => ({ t, y }));
    }
    case "stock_price": {
      const key = Deno.env.get("TWELVEDATA_API_KEY");
      if (!key) throw new Error("No Twelve Data key configured server-side.");
      const symbols = params.symbols.join(",");
      const res = await fetch(`https://api.twelvedata.com/quote?symbol=${symbols}&apikey=${key}`);
      const data = await res.json();
      return params.symbols.length === 1 ? { [params.symbols[0]]: data } : data;
    }
    case "stock_chart": {
      const key = Deno.env.get("TWELVEDATA_API_KEY");
      if (!key) throw new Error("No Twelve Data key configured server-side.");
      const res = await fetch(`https://api.twelvedata.com/time_series?symbol=${params.symbol}&interval=${params.interval || "1day"}&outputsize=${params.outputsize || 30}&apikey=${key}`);
      const data = await res.json();
      if (!data.values) return [];
      return data.values.reverse().map(v => ({ t: new Date(v.datetime).getTime(), y: parseFloat(v.close) }));
    }
    case "youtube_channel": {
      const key = Deno.env.get("YOUTUBE_API_KEY");
      if (!key) throw new Error("No YouTube key configured server-side.");
      const chRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=contentDetails,snippet&id=${params.channelId}&key=${key}`);
      const chData = await chRes.json();
      if (chData.error) throw new Error(chData.error.message);
      const channel = chData.items && chData.items[0];
      if (!channel) throw new Error("Channel not found.");
      const uploadsPlaylistId = channel.contentDetails.relatedPlaylists.uploads;
      const plRes = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=${params.count || 10}&key=${key}`);
      const plData = await plRes.json();
      if (plData.error) throw new Error(plData.error.message);
      return (plData.items || []).map(item => ({
        title: item.snippet.title,
        link: `https://www.youtube.com/watch?v=${item.snippet.resourceId.videoId}`,
        source: channel.snippet.title,
        date: item.snippet.publishedAt,
        thumbnail: (item.snippet.thumbnails?.medium || item.snippet.thumbnails?.default || {}).url || null
      }));
    }
    case "youtube_resolve_handle": {
      const key = Deno.env.get("YOUTUBE_API_KEY");
      if (!key) throw new Error("No YouTube key configured server-side.");
      const res = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${encodeURIComponent(params.handle)}&key=${key}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      if (!data.items || !data.items.length) throw new Error(`Couldn't find a channel for @${params.handle}`);
      return { channelId: data.items[0].id };
    }
    case "youtube_search": {
      const key = Deno.env.get("YOUTUBE_API_KEY");
      if (!key) throw new Error("No YouTube key configured server-side.");
      const res = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(params.query)}&type=video&order=date&maxResults=${params.count || 10}&key=${key}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      return (data.items || []).map(item => ({
        title: item.snippet.title,
        link: `https://www.youtube.com/watch?v=${item.id.videoId}`,
        source: item.snippet.channelTitle,
        date: item.snippet.publishedAt,
        thumbnail: (item.snippet.thumbnails?.medium || item.snippet.thumbnails?.default || {}).url || null
      }));
    }
    case "opensea_stats": {
      const key = Deno.env.get("OPENSEA_API_KEY");
      const headers = key ? { "X-API-KEY": key } : {};
      const res = await fetch(`https://api.opensea.io/api/v2/collections/${params.slug}/stats`, { headers });
      if (!res.ok) throw new Error(`OpenSea request failed (${res.status})`);
      return res.json();
    }
    case "news_rss": {
      const key = Deno.env.get("RSS2JSON_API_KEY");
      const keyParam = key ? `&api_key=${key}` : "";
      const res = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(params.rssUrl)}${keyParam}&count=${Math.min(params.count || 10, 10)}`);
      const data = await res.json();
      if (data.status !== "ok") throw new Error(data.message || "RSS feed error");
      return data.items || [];
    }
    default:
      throw new Error("Unhandled domain: " + domain);
  }
}
