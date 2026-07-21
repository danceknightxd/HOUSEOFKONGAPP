/* ============================================================
   THE THRONE — SOCIAL FEEDS ENGINE (YouTube + X)
   Both return items shaped exactly like feeds.js's news items
   ({topic, title, link, source, date, thumbnail}) so they can be
   rendered with the exact same ThroneFeeds.renderNewsList /
   renderSkeleton the News view already uses — same look, same code.
   ============================================================ */

const ThroneSocialFeeds = (() => {

  function looksLikeChannelId(s) { return /^UC[\w-]{22}$/.test(s); }

  // ---------- YouTube: topic search (needs an API key) ----------
  async function searchYouTubeTopic(topic, count = 10) {
    if (!YOUTUBE_CONFIG.apiKey) throw new Error("NEEDS_KEY");
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(topic)}&type=video&order=date&maxResults=${count}&key=${YOUTUBE_CONFIG.apiKey}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.error) throw new Error(data.error.message || "YouTube API error");
    return (data.items || []).map(item => ({
      topic: "YouTube",
      title: item.snippet.title,
      link: `https://www.youtube.com/watch?v=${item.id.videoId}`,
      source: item.snippet.channelTitle,
      date: item.snippet.publishedAt,
      thumbnail: (item.snippet.thumbnails && (item.snippet.thumbnails.medium || item.snippet.thumbnails.default) || {}).url || null
    }));
  }

  // ---------- YouTube: follow a channel (keyless if given a channel ID) ----------
  async function getYouTubeChannelVideos(identifier, count = 10) {
    let channelId = identifier.trim().replace(/^@/, "");

    if (!looksLikeChannelId(channelId)) {
      // It's a handle, not a raw channel ID — resolving that to an ID
      // needs the real API; the RSS trick only works with the ID itself.
      if (!YOUTUBE_CONFIG.apiKey) throw new Error("NEEDS_KEY_FOR_HANDLE");
      const lookupUrl = `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${encodeURIComponent(channelId)}&key=${YOUTUBE_CONFIG.apiKey}`;
      const res = await fetch(lookupUrl);
      const data = await res.json();
      if (data.error || !data.items || !data.items.length) throw new Error(`Couldn't find a channel for @${channelId}`);
      channelId = data.items[0].id;
    }

    // Keyless from here — same RSS+rss2json trick King's Colosseum uses.
    const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
    const key = THRONE_CONFIG.rss2jsonApiKey ? `&api_key=${THRONE_CONFIG.rss2jsonApiKey}` : "";
    const endpoint = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}${key}&count=${count}`;
    const res2 = await fetch(endpoint);
    const data2 = await res2.json();
    if (data2.status !== "ok") throw new Error(data2.message || "Channel feed unavailable");
    return (data2.items || []).slice(0, count).map(item => ({
      topic: "YouTube",
      title: item.title,
      link: item.link,
      source: (data2.feed && data2.feed.title) || channelId,
      date: item.pubDate,
      thumbnail: item.thumbnail || (item.enclosure && item.enclosure.link) || null
    }));
  }

  // ---------- X: everything routes through a server-side proxy ----------
  // The Bearer token this needs is a paid, metered credential (X API has
  // no free tier as of Feb 2026) — it lives only in the Edge Function's
  // secrets, never in client code, so it can't be lifted from page source
  // and used to run up your bill. See X_API_SETUP.md.
  async function searchXTopic(topic, count = 10) {
    const { data, error } = await supabaseClient.functions.invoke("x-search-proxy", {
      body: { mode: "search", query: topic, count }
    });
    if (error) throw error;
    if (data && data.error) throw new Error(data.error);
    return (data && data.items) || [];
  }

  async function getXUserTweets(handle, count = 10) {
    const { data, error } = await supabaseClient.functions.invoke("x-search-proxy", {
      body: { mode: "user", handle: handle.replace(/^@/, ""), count }
    });
    if (error) throw error;
    if (data && data.error) throw new Error(data.error);
    return (data && data.items) || [];
  }

  return {
    searchYouTubeTopic, getYouTubeChannelVideos,
    searchXTopic, getXUserTweets,
    looksLikeChannelId
  };
})();
