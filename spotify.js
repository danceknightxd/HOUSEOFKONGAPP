/* ============================================================
   THE THRONE — SPOTIFY (real integration, PKCE flow)
   Why PKCE and not the usual client-secret flow: a purely
   client-side app can't keep a secret safe (anyone can view-source
   it). PKCE is the OAuth flow designed specifically for that case —
   Spotify verifies you via a one-time cryptographic proof instead
   of a hidden secret. This is the technically correct way to do
   this without standing up a backend.
   ============================================================ */

const ThroneSpotify = (() => {

  const TOKEN_KEY = "throne_spotify_tokens";

  // ---------- PKCE helpers ----------
  function randomString(len) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    return Array.from(crypto.getRandomValues(new Uint8Array(len)))
      .map(b => chars[b % chars.length]).join("");
  }

  async function sha256Base64Url(str) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function getStoredTokens() {
    try { return JSON.parse(localStorage.getItem(TOKEN_KEY)); } catch (e) { return null; }
  }
  function storeTokens(tokens) {
    tokens.obtained_at = Date.now();
    localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
  }
  function clearTokens() {
    localStorage.removeItem(TOKEN_KEY);
  }

  function isConnected() {
    return !!getStoredTokens();
  }

  // ---------- auth flow ----------
  async function connect() {
    const verifier = randomString(64);
    sessionStorage.setItem("throne_spotify_verifier", verifier);
    const challenge = await sha256Base64Url(verifier);

    const params = new URLSearchParams({
      client_id: SPOTIFY_CONFIG.clientId,
      response_type: "code",
      redirect_uri: SPOTIFY_CONFIG.redirectUri,
      code_challenge_method: "S256",
      code_challenge: challenge,
      scope: SPOTIFY_CONFIG.scopes
    });
    window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
  }

  function disconnect() {
    clearTokens();
  }

  // Call once on page load — handles the redirect back from Spotify.
  async function handleRedirect() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (!code) return false;

    const verifier = sessionStorage.getItem("throne_spotify_verifier");
    const body = new URLSearchParams({
      client_id: SPOTIFY_CONFIG.clientId,
      grant_type: "authorization_code",
      code,
      redirect_uri: SPOTIFY_CONFIG.redirectUri,
      code_verifier: verifier
    });

    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });
    const data = await res.json();
    if (data.access_token) {
      storeTokens(data);
      // clean the ?code= out of the URL so refreshing doesn't retry it
      window.history.replaceState({}, document.title, window.location.pathname);
      return true;
    }
    return false;
  }

  async function refreshIfNeeded() {
    const tokens = getStoredTokens();
    if (!tokens) return null;
    const ageSeconds = (Date.now() - tokens.obtained_at) / 1000;
    if (ageSeconds < tokens.expires_in - 60) return tokens;

    const body = new URLSearchParams({
      client_id: SPOTIFY_CONFIG.clientId,
      grant_type: "refresh_token",
      refresh_token: tokens.refresh_token
    });
    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });
    const data = await res.json();
    if (data.access_token) {
      // Spotify may omit refresh_token on refresh — keep the old one.
      storeTokens({ ...tokens, ...data });
      return getStoredTokens();
    }
    clearTokens();
    return null;
  }

  async function apiGet(path) {
    const tokens = await refreshIfNeeded();
    if (!tokens) throw new Error("Not connected to Spotify.");
    const res = await fetch(`https://api.spotify.com/v1${path}`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });
    if (res.status === 204) return null; // e.g. nothing currently playing
    if (!res.ok) throw new Error(`Spotify API error: ${res.status}`);
    return res.json();
  }

  async function getNowPlaying() {
    return apiGet("/me/player/currently-playing");
  }

  async function getRecentlyPlayed(limit = 5) {
    return apiGet(`/me/player/recently-played?limit=${limit}`);
  }

  return { isConnected, connect, disconnect, handleRedirect, getNowPlaying, getRecentlyPlayed };
})();
