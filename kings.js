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
  async function getCollectionStats(slug) {
    const headers = {};
    if (KINGS_CONFIG.exhibitions.openseaApiKey) {
      headers["X-API-KEY"] = KINGS_CONFIG.exhibitions.openseaApiKey;
    }
    const res = await fetch(`https://api.opensea.io/api/v2/collections/${slug}/stats`, { headers });
    if (!res.ok) throw new Error(`OpenSea request failed (${res.status})`);
    return res.json();
  }

  async function getCollectionInfo(slug) {
    const headers = {};
    if (KINGS_CONFIG.exhibitions.openseaApiKey) {
      headers["X-API-KEY"] = KINGS_CONFIG.exhibitions.openseaApiKey;
    }
    const res = await fetch(`https://api.opensea.io/api/v2/collections/${slug}`, { headers });
    if (!res.ok) throw new Error(`OpenSea request failed (${res.status})`);
    return res.json();
  }

  return {
    renderInstagramPosts,
    spotifyShowEmbedUrl,
    getCollectionStats,
    getCollectionInfo
  };
})();
