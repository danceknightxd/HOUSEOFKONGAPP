/* ============================================================
   THE THRONE — SUPABASE CLIENT
   ============================================================ */

/* ============================================================
   THE THRONE — SUPABASE CLIENT
   Session persistence is explicit here (not just default behavior)
   so staying signed in across app restarts is reliable rather than
   depending on Supabase's default config not changing later.
   ============================================================ */

const supabaseClient = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
    storageKey: "throne-auth-session"
  }
});
