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
      kingdomTitle: "The Forge Kingdom",
      tagline: "Discipline, self-improvement, the FORGE series.",
      accent: "#b3453a",
      accentBright: "#d96856",
      url: "https://projectdlab.blogspot.com/feeds/posts/default?alt=json-in-script&max-results=12"
    },
    {
      id: "spire",
      blogName: "emdexter",
      kingdomTitle: "The Spire Kingdom",
      tagline: "Technology, AI, ideas ahead of their time.",
      accent: "#3d7a96",
      accentBright: "#5fa8c9",
      url: "https://emdexter.blogspot.com/feeds/posts/default?alt=json-in-script&max-results=12"
    },
    {
      id: "court",
      blogName: "danceknightprime",
      kingdomTitle: "The Court Kingdom",
      tagline: "K-pop, culture, entertainment.",
      accent: "#b3527a",
      accentBright: "#d9749e",
      url: "https://danceknightprime.blogspot.com/feeds/posts/default?alt=json-in-script&max-results=12"
    },
    {
      id: "gallery",
      blogName: "chimpmagnettrillionaireclub",
      kingdomTitle: "The Gallery Kingdom",
      tagline: "Art, visual work, the trillionaire club.",
      accent: "#3f8f6a",
      accentBright: "#5cbf8f",
      url: "https://chimpmagnettrillionaireclub.blogspot.com/feeds/posts/default?alt=json-in-script&max-results=12"
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
