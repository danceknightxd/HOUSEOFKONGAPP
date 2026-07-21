// ============================================================
// THE THRONE — X-SEARCH-PROXY (Supabase Edge Function)
// Proxies both X feed modes the app supports:
//   mode: "search" — recent tweets matching a topic/keyword
//   mode: "user"    — an account's recent tweets by @handle
//
// Why this exists as a server-side function instead of a client
// config: X's Bearer token is billed per-read (X API has no free tier
// as of Feb 2026 — see X_API_SETUP.md). Every other key in this app
// (Twelve Data, OpenSea, rss2json) is safe to put in client code
// because it's either free-tier or low-stakes if someone copies it.
// This one isn't — anyone who found it in your page source could run
// up real charges on your account. Keeping it as a secret this
// function alone can read is what prevents that.
//
// Secret this function needs: X_BEARER_TOKEN (App-Only Bearer Token
// from your X developer app — see X_API_SETUP.md for how to get one
// and what it costs).
// ============================================================

Deno.serve(async (req) => {
  try {
    const token = Deno.env.get("X_BEARER_TOKEN");
    if (!token) {
      return new Response(JSON.stringify({ error: "X isn't set up yet — see X_API_SETUP.md to add your Bearer Token." }), { status: 200 });
    }

    const { mode, query, handle, count } = await req.json();
    const headers = { Authorization: `Bearer ${token}` };
    // X's endpoints require max_results between 10 and 100.
    const maxResults = Math.min(Math.max(parseInt(count) || 10, 10), 100);

    let items = [];

    if (mode === "search") {
      if (!query || !query.trim()) {
        return new Response(JSON.stringify({ error: "No search topic given." }), { status: 200 });
      }
      const url = `https://api.x.com/2/tweets/search/recent?query=${encodeURIComponent(query)}&max_results=${maxResults}&tweet.fields=created_at,author_id&expansions=author_id&user.fields=username,name`;
      const res = await fetch(url, { headers });
      const data = await res.json();
      if (!res.ok) {
        return new Response(JSON.stringify({ error: (data.errors && data.errors[0] && data.errors[0].message) || data.title || `X API error (${res.status})` }), { status: 200 });
      }
      const usersById = {};
      (data.includes && data.includes.users || []).forEach(u => { usersById[u.id] = u; });
      items = (data.data || []).map(t => {
        const user = usersById[t.author_id];
        return {
          topic: "X",
          title: t.text,
          link: user ? `https://x.com/${user.username}/status/${t.id}` : `https://x.com/i/status/${t.id}`,
          source: user ? `@${user.username}` : "X",
          date: t.created_at,
          thumbnail: null
        };
      });
    } else if (mode === "user") {
      if (!handle || !handle.trim()) {
        return new Response(JSON.stringify({ error: "No account given." }), { status: 200 });
      }
      const cleanHandle = handle.trim().replace(/^@/, "");
      const userRes = await fetch(`https://api.x.com/2/users/by/username/${encodeURIComponent(cleanHandle)}`, { headers });
      const userData = await userRes.json();
      if (!userRes.ok || !userData.data) {
        return new Response(JSON.stringify({ error: (userData.errors && userData.errors[0] && userData.errors[0].detail) || `Couldn't find @${cleanHandle}` }), { status: 200 });
      }
      const userId = userData.data.id;
      const tlUrl = `https://api.x.com/2/users/${userId}/tweets?max_results=${maxResults}&tweet.fields=created_at&exclude=retweets,replies`;
      const tlRes = await fetch(tlUrl, { headers });
      const tlData = await tlRes.json();
      if (!tlRes.ok) {
        return new Response(JSON.stringify({ error: (tlData.errors && tlData.errors[0] && tlData.errors[0].message) || `X API error (${tlRes.status})` }), { status: 200 });
      }
      items = (tlData.data || []).map(t => ({
        topic: "X",
        title: t.text,
        link: `https://x.com/${cleanHandle}/status/${t.id}`,
        source: `@${cleanHandle}`,
        date: t.created_at,
        thumbnail: null
      }));
    } else {
      return new Response(JSON.stringify({ error: "Invalid request." }), { status: 200 });
    }

    return new Response(JSON.stringify({ items }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 200 });
  }
});
