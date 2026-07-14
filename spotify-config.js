/* ============================================================
   THE THRONE — SPOTIFY CONFIG
   Create a free app at https://developer.spotify.com/dashboard
   → Settings → add a Redirect URI matching EXACTLY where you host
   this app (e.g. https://yourname.github.io/the-throne/index.html)
   → paste the Client ID below. No client secret needed — this uses
   the PKCE flow, which is designed for pure client-side apps.
   ============================================================ */

const SPOTIFY_CONFIG = {
  clientId: "4257deb0fae44d388b7675b5a4e5f41e",
  redirectUri: window.location.origin + window.location.pathname,
  scopes: "user-read-currently-playing user-read-recently-played user-read-playback-state"
};
