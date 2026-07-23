/* ============================================================
   THE THRONE — KINGS WINGS ENGINE
   ============================================================ */

const ThroneKings = (() => {

  // ---------- KING'S GALLERY (Instagram post embeds) ----------
  let instagramScriptLoaded = false;

  function loadInstagramEmbedScript() {
    return new Promise((resolve) => {
      if (instagramScriptLoaded && window.instgrm) return resolve();
      if (window.instgrm) { instagramScriptLoaded = true; return resolve(); }
      const script = document.createElement("script");
      script.src = "https://www.instagram.com/embed.js";
      script.async = true;
      script.onload = () => { instagramScriptLoaded = true; resolve(); };
      script.onerror = () => resolve(); // fail quietly, card just won't render
      document.body.appendChild(script);
    });
  }

  function instagramEmbedHtml(postUrl) {
    return `
      <blockquote class="instagram-media" data-instgrm-captioned
        data-instgrm-permalink="${postUrl}" data-instgrm-version="14"
        style="background:#0a0a0a; border:1px solid #2a251c; border-radius:12px; margin:0 0 20px; max-width:100%; min-width:280px;">
      </blockquote>`;
  }

  async function renderInstagramPosts(containerEl, postUrls) {
    if (!postUrls.length) {
      containerEl.innerHTML = `<div class="feed-empty">No posts added yet — paste an Instagram post link below to add one to the Gallery.</div>`;
      return;
    }
    containerEl.innerHTML = postUrls.map(instagramEmbedHtml).join("");
    await loadInstagramEmbedScript();
    if (window.instgrm) window.instgrm.Embeds.process();
  }

  // ---------- KING'S MESSAGE (Spotify show embed) ----------
  function spotifyShowEmbedUrl() {
    return `https://open.spotify.com/embed/show/${KINGS_CONFIG.message.showId}?utm_source=generator&theme=0`;
  }

  // ---------- KING'S ART EXHIBITIONS (OpenSea) ----------
  // Now routed through the data-proxy (see data-proxy.ts) — caches
  // stats for 10 minutes and serves the last-known value if OpenSea
  // is briefly down, instead of a hard error.
  async function getCollectionStats(slug) {
    const res = await ThroneProxy.call("opensea_stats", { slug });
    return res.data;
  }

  // ---------- KING'S COLOSSEUM (YouTube channel) ----------
  // Also routed through the proxy now — the YOUTUBE_API_KEY lives
  // server-side as an Edge Function secret, not in client code, and
  // responses are cached for 15 minutes so opening this tab
  // repeatedly doesn't burn quota or hit a live YouTube call every time.
  async function getChannelVideos(channelId, count = 12) {
    const res = await ThroneProxy.call("youtube_channel", { channelId, count });
    return res.data.map(v => ({ title: v.title, link: v.link, thumbnail: v.thumbnail, published: v.date }));
  }

  return {
    renderInstagramPosts,
    spotifyShowEmbedUrl,
    getCollectionStats,
    getChannelVideos
  };
})();
