/* ============================================================
   THE THRONE — WEBRTC CONFIG (optional)
   Calling works over a free public STUN server out of the box, which
   is enough for most home/office wifi and most mobile networks. It
   is NOT enough on networks that block direct peer-to-peer traffic
   (some corporate/school networks, some carrier CGNAT setups, wifi
   with client isolation enabled) — on those, a call will get stuck
   on "Connecting…" with only your own camera ever showing, because
   the two devices can never find a direct path to each other.

   Fix: add a TURN server below, which relays the call instead of
   requiring a direct connection. Leave this blank and calling still
   works the same as before — it just won't help on those networks.

   Free tier that works fine for personal use: https://www.metered.ca/tools/openrelay/
   (no credit card, gives you a urls/username/credential set to paste below)
   Paid alternatives if you outgrow the free tier: Twilio, Cloudflare Calls, Xirsys.
   ============================================================ */

const WEBRTC_CONFIG = {
  turnServers: [
    // Example — uncomment and fill in with your own credentials:
    // { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
    // { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" }
  ]
};
