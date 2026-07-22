/* ============================================================
   THE THRONE — SOCIAL FEEDS ENGINE (YouTube)
   Items are shaped exactly like feeds.js's news items ({topic, title,
   link, source, date, thumbnail}) so they render with the exact same
   ThroneFeeds.renderNewsList/renderSkeleton the News view uses —
   same look, same code, as requested.

   Both channel-follow and topic search go through the real YouTube
   Data API v3 (needs YOUTUBE_CONFIG.apiKey) — an earlier version
   tried a keyless RSS route for channel-follow, but YouTube's RSS
   feed has ongoing reliability problems independent of this app, so
   everything now goes through the one reliable path consistently.

   (X/Twitter support was removed entirely — X's API has no free
   tier as of Feb 2026, so that feed panel is gone from the app.)
   ============================================================ */

const ThroneSocialFeeds = (() => {

  function looksLikeChannelId(s) { return /^UC[\w-]{22}$/.test(s); }

  async function resolveChannelId(identifier) {
    const cleaned = identifier.trim().replace(/^@/, "");
    if (looksLikeChannelId(cleaned)) return cleaned;
    const res = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${encodeURIComponent(cleaned)}&key=${YOUTUBE_CONFIG.apiKey}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error.message || "YouTube API error");
    if (!data.items || !data.items.length) throw new Error(`Couldn't find a channel for @${cleaned}`);
    return data.items[0].id;
  }

  // ---------- follow a channel ----------
  async function getYouTubeChannelVideos(identifier, count = 10) {
    if (!YOUTUBE_CONFIG.apiKey) throw new Error("NEEDS_KEY");
    const channelId = await resolveChannelId(identifier);

    const chRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=contentDetails,snippet&id=${channelId}&key=${YOUTUBE_CONFIG.apiKey}`);
    const chData = await chRes.json();
    if (chData.error) throw new Error(chData.error.message || "YouTube API error");
    const channel = chData.items && chData.items[0];
    if (!channel) throw new Error("Channel not found.");
    const uploadsPlaylistId = channel.contentDetails.relatedPlaylists.uploads;

    const plRes = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=${count}&key=${YOUTUBE_CONFIG.apiKey}`);
    const plData = await plRes.json();
    if (plData.error) throw new Error(plData.error.message || "YouTube API error");

    return (plData.items || []).map(item => ({
      topic: "YouTube",
      title: item.snippet.title,
      link: `https://www.youtube.com/watch?v=${item.snippet.resourceId.videoId}`,
      source: channel.snippet.title,
      date: item.snippet.publishedAt,
      thumbnail: (item.snippet.thumbnails && (item.snippet.thumbnails.medium || item.snippet.thumbnails.default) || {}).url || null
    }));
  }

  // ---------- search by topic ----------
  async function searchYouTubeTopic(topic, count = 10) {
    if (!YOUTUBE_CONFIG.apiKey) throw new Error("NEEDS_KEY");
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(topic)}&type=video&order=date&maxResults=${count}&key=${YOUTUBE_CONFIG.apiKey}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.error) throw new Error(data.error.message || "YouTube API error");
    return (data.items || []).map(item => ({
      topic: topic,
      title: item.snippet.title,
      link: `https://www.youtube.com/watch?v=${item.id.videoId}`,
      source: item.snippet.channelTitle,
      date: item.snippet.publishedAt,
      thumbnail: (item.snippet.thumbnails && (item.snippet.thumbnails.medium || item.snippet.thumbnails.default) || {}).url || null
    }));
  }

  return {
    getYouTubeChannelVideos, searchYouTubeTopic, looksLikeChannelId, resolveChannelId
  };
})();
