/* ============================================================
   THE THRONE — PUSH NOTIFICATIONS CONFIG
   The VAPID public key below is meant to be public — it's how the
   browser verifies push messages actually came from your server.
   The matching PRIVATE key lives only in your Supabase Edge Function
   secrets (see EDGE_FUNCTION_SETUP.md) — never put it here.
   ============================================================ */

const PUSH_CONFIG = {
  vapidPublicKey: "BCyXoh1mtOBP9scqt3_mfzTUW_pCASHsIMf8dZQC_4_u8DgDvt3RQQmA-GRmfEbtLu8aZBZXN5-Zu6A78m9xbBY"
};
