/* ============================================================
   THE THRONE — SOCIAL FEEDS ENGINE (YouTube)
   Items are shaped like feeds.js's news items ({topic, title, link,
   source, date, thumbnail}) so they render with the same
   ThroneFeeds.renderNewsList/renderSkeleton the News view uses.

   Now routed through the data-proxy Edge Function — the YouTube key
   lives server-side as a secret (YOUTUBE_API_KEY), not in client
   code, and responses are cached so repeated visits don't re-spend
   quota on identical requests.
   ============================================================ */

const ThroneSocialFeeds = (() => {

  function looksLikeChannelId(s) { return /^UC[\w-]{22}$/.test(s); }

  async function resolveChannelId(identifier) {
    const cleaned = identifier.trim().replace(/^@/, "");
    if (looksLikeChannelId(cleaned)) return cleaned;
    const res = await ThroneProxy.call("youtube_resolve_handle", { handle: cleaned });
    return res.data.channelId;
  }

  async function getYouTubeChannelVideos(identifier, count = 10) {
    const channelId = await resolveChannelId(identifier);
    const res = await ThroneProxy.call("youtube_channel", { channelId, count });
    return res.data.map(v => ({ topic: "YouTube", title: v.title, link: v.link, source: v.source, date: v.date, thumbnail: v.thumbnail }));
  }

  async function searchYouTubeTopic(topic, count = 10) {
    const res = await ThroneProxy.call("youtube_search", { query: topic, count });
    return res.data.map(v => ({ topic, title: v.title, link: v.link, source: v.source, date: v.date, thumbnail: v.thumbnail }));
  }

  return {
    getYouTubeChannelVideos, searchYouTubeTopic, looksLikeChannelId, resolveChannelId
  };
})();
