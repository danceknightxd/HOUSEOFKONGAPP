/* ============================================================
   THE THRONE — CONFIG
   Edit this file to point the app at your own feeds.
   No build step needed — just save and refresh.
   ============================================================ */

const THRONE_CONFIG = {

  // ---- House of Kong network (Blogger label feeds, JSONP) ----
  // These populate "The Circle" cross-post queue + can feed the
  // dashboard briefing if you want your own posts mixed in.
  bloggerFeeds: [
    {
      name: "projectdlab",
      label: "UNNECESSARY",
      url: "https://projectdlab.blogspot.com/feeds/posts/default/-/UNNECESSARY?alt=json-in-script"
    },
    {
      name: "emdexter",
      label: "UNNECESSARY",
      url: "https://emdexter.blogspot.com/feeds/posts/default/-/UNNECESSARY?alt=json-in-script"
    },
    {
      name: "danceknightprime",
      label: "KPOP CENTRAL",
      url: "https://danceknightprime.blogspot.com/feeds/posts/default/-/KPOP%20CENTRAL?alt=json-in-script"
    }
  ],

  // ---- THE REALM — the four Kingdoms of House of Kong ----
  // Full network feeds (no label filter) so each Kingdom shows
  // everything published there, not one category. id must be unique —
  // used as a CSS class hook (kingdom-<id>) for each Kingdom's accent.
  kingdoms: [
    {
      id: "forge",
      blogName: "projectdlab",
      kingdomTitle: "The ProjectDlab Kingdom",
      tagline: "Discipline, self-improvement, the FORGE series.",
      accent: "#b3453a",
      accentBright: "#d96856",
      url: "https://projectdlab.blogspot.com/feeds/posts/default?alt=json-in-script&max-results=12",
      // 3D seal — GLB served via jsDelivr's GitHub CDN (raw.githubusercontent.com
      // works too, but jsDelivr guarantees CORS headers + caching, which
      // <model-viewer> needs to load cleanly in the browser).
      modelUrl: "https://cdn.jsdelivr.net/gh/danceknightxd/DLABMODEL@main/compressed-Meshy_AI_Goggles_of_Adventure_0701075048_texture.glb",
      inviteUrl: "https://projectdlab.blogspot.com/",
      inviteLabel: "Join ProjectDlab"
    },
    {
      id: "spire",
      blogName: "emdexter",
      kingdomTitle: "The Emdexter Kingdom",
      tagline: "Technology, AI, ideas ahead of their time.",
      accent: "#3d7a96",
      accentBright: "#5fa8c9",
      url: "https://emdexter.blogspot.com/feeds/posts/default?alt=json-in-script&max-results=12",
      modelUrl: "https://cdn.jsdelivr.net/gh/danceknightxd/EMDMODEL@main/compressed-Meshy_AI_Neon_City_Riders_0701075039_texture.glb",
      inviteUrl: "https://emdexter.blogspot.com/",
      inviteLabel: "Join Emdexter"
    },
    {
      id: "court",
      blogName: "danceknightprime",
      kingdomTitle: "The DanceKnightPrime Kingdom",
      tagline: "K-pop, culture, entertainment.",
      accent: "#b3527a",
      accentBright: "#d9749e",
      url: "https://danceknightprime.blogspot.com/feeds/posts/default?alt=json-in-script&max-results=12",
      modelUrl: "https://cdn.jsdelivr.net/gh/danceknightxd/DKNIGHTMODEL@main/compressed-Meshy_AI_Neon_Pals_Adventure_0701075009_texture.glb",
      // NOTE: the invite URL requested for this Kingdom pointed at the
      // ProjectDlab blog, which looked like a copy/paste slip since every
      // other Kingdom invites to its own blog — pointed this one at
      // danceknightprime.blogspot.com instead. Flag if that's wrong.
      inviteUrl: "https://danceknightprime.blogspot.com/",
      inviteLabel: "Join DanceKnightPrime"
    },
    {
      id: "gallery",
      blogName: "chimpmagnettrillionaireclub",
      kingdomTitle: "The Gallery Kingdom",
      tagline: "Art, visual work, the trillionaire club.",
      accent: "#3f8f6a",
      accentBright: "#5cbf8f",
      url: "https://chimpmagnettrillionaireclub.blogspot.com/feeds/posts/default?alt=json-in-script&max-results=12",
      modelUrl: "https://cdn.jsdelivr.net/gh/danceknightxd/chimpart@main/Meshy_AI_Chimp_Magnet_Trillio_0527115757_texture.glb",
      inviteUrl: "https://chimptrillionaireclub.blogspot.com/?zx=910e11d28e2e5c78",
      inviteLabel: "Join The Gallery Kingdom"
    }
  ],

  // ---- News topics (external RSS, pulled via rss2json.com) ----
  // Toggle "enabled" per topic — matches the chip toggles in the UI.
  // Swap the rss url for any feed you want; rss2json needs no key
  // for light personal use, add your own key below if you hit limits.
  rss2jsonApiKey: "", // optional — get a free key at rss2json.com if needed
  topics: [
    { name: "AI & Culture",      enabled: true,  rss: "https://www.theverge.com/rss/index.xml" },
    { name: "K-Pop",              enabled: true,  rss: "https://www.soompi.com/feed" },
    { name: "Fitness Science",    enabled: true,  rss: "https://www.strongerbyscience.com/feed/" },
    { name: "Design & Branding",  enabled: true,  rss: "https://www.itsnicethat.com/rss" },
    { name: "Crypto",             enabled: false, rss: "https://cointelegraph.com/rss" },
    { name: "World",              enabled: false, rss: "http://feeds.bbci.co.uk/news/world/rss.xml" }
  ],

  // How many items to pull per topic (from the source, before pagination).
  // NOTE: rss2json's free tier (no API key) rejects counts above ~10 with
  // a 422 error — keep this at 10 unless you've added rss2jsonApiKey above.
  itemsPerTopic: 10,

  // How many items shown in the dashboard "Briefing" panel (mixed, newest-first)
  dashboardBriefingCount: 5,

  // News view pagination — how many articles show per "page"
  newsPageSize: 10
};
