// ============================================================
// THE THRONE — NOTIFY ALLIANCE (Supabase Edge Function)
// Fires when a new row lands in `alliances` (via a Database Webhook
// you configure in the Supabase dashboard — see EDGE_FUNCTION_SETUP.md).
// Sends a REAL push notification — Messenger-style, works even if
// the recipient doesn't have The Throne open.
//
// Secrets this function needs (set via `supabase secrets set`):
//   VAPID_PUBLIC_KEY   — same one in push-config.js
//   VAPID_PRIVATE_KEY  — the matching private key. NEVER put this in
//                        any client-side file — this is exactly why
//                        it lives here instead.
//   VAPID_SUBJECT      — a contact, e.g. mailto:you@example.com
//   APP_URL            — your live app URL
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically
// by Supabase to every Edge Function.
// ============================================================

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3";

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const record = payload.record;
    if (!record || payload.type !== "INSERT") {
      return new Response(JSON.stringify({ skipped: true }), { status: 200 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    webpush.setVapidDetails(
      Deno.env.get("VAPID_SUBJECT")!,
      Deno.env.get("VAPID_PUBLIC_KEY")!,
      Deno.env.get("VAPID_PRIVATE_KEY")!
    );

    const [{ data: requester }, { data: subs }] = await Promise.all([
      supabase.from("profiles").select("email, display_name").eq("id", record.requester_id).maybeSingle(),
      supabase.from("push_subscriptions").select("*").eq("user_id", record.recipient_id)
    ]);

    if (!subs || !subs.length) {
      return new Response(JSON.stringify({ skipped: "recipient has no push subscriptions" }), { status: 200 });
    }

    const requesterName = requester?.display_name || requester?.email || "Someone";
    const notifTitle = "New Alliance Request";
    const notifBody = `${requesterName} wants to ally with you on The Throne.`;
    const notifUrl = Deno.env.get("APP_URL") || "./";
    const payloadStr = JSON.stringify({ title: notifTitle, body: notifBody, url: notifUrl });

    // In-app record, alongside the OS push — swiping away the push
    // notification used to mean it was gone for good, with nothing
    // inside the app to review later.
    supabase.from("notifications").insert({
      user_id: record.recipient_id, title: notifTitle, body: notifBody, url: notifUrl
    }).then(() => {}, () => {});

    const results = await Promise.allSettled(
      subs.map(sub => webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
        payloadStr
      ).catch(async (err) => {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        }
        throw err;
      }))
    );

    return new Response(JSON.stringify({ sent: results.filter(r => r.status === "fulfilled").length, total: subs.length }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 200 });
  }
});
