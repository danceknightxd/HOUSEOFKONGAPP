/* ============================================================
   THE THRONE — KINGS WINGS CONFIG
   Three real integrations, each using the right approach for what
   that platform actually allows publicly:
   - Instagram: no public profile embed exists, but individual posts
     can be embedded live via Instagram's own official widget script
     (instgrm) — no login, no API key, real content.
   - Spotify Show: Spotify's own iframe embed player — fully
     interactive (browse + play episodes), no OAuth needed at all.
   - OpenSea: public REST API for collection stats. Works without a
     key at low volume; add a free key if you hit rate limits.
   ============================================================ */

const KINGS_CONFIG = {
  gallery: {
    title: "King's Gallery",
    handle: "chimp_magnettrillionaireclub",
    profileUrl: "https://www.instagram.com/chimp_magnettrillionaireclub",
    tagline: "Art, visuals, and the trillionaire club — straight from the source."
    // Add post URLs to embed via the "Log a Post" flow in the app itself
    // (stored in Supabase's social_posts table), or paste directly below
    // as a fallback starter set:
  },

  message: {
    title: "King's Message",
    showId: "1Uh26YeHc8sQQQd2WjnkIo", // from the Spotify show URL
    tagline: "The House of Kong podcast — every episode, playable right here."
  },

  exhibitions: {
    title: "King's Art Exhibitions",
    openseaApiKey: "", // optional — free at https://docs.opensea.io/reference/api-keys
    collections: [
      { slug: "CHIMPmagnetTRILLIONAIREclubMANSION", label: "The Mansion" },
      { slug: "CHIMPmagnetTRILLIONAIREclubPENTHOUSE", label: "The Penthouse" }
    ]
  }
};
