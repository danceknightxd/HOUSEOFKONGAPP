// ============================================================
// THE THRONE — NOTIFY TASK REMINDER (Supabase Edge Function)
// Unlike notify-alliance (fires on an INSERT webhook), this one is
// meant to be called on a SCHEDULE — every minute, via Supabase's
// dashboard Cron Jobs (Database → Cron Jobs) or pg_cron. Each run it
// checks for any task whose reminder_at has arrived and hasn't been
// sent yet, pushes a notification, then marks it sent so it doesn't
// fire again on the next run.
//
// Secrets this function needs (same ones notify-alliance already
// uses — set once, both functions share them):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, APP_URL
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.
// ============================================================

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3";

Deno.serve(async (_req) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: dueTasks, error } = await supabase
      .from("tasks")
      .select("id, user_id, title, reminder_at")
      .lte("reminder_at", new Date().toISOString())
      .eq("reminder_sent", false)
      .eq("done", false);

    if (error) throw error;
    if (!dueTasks || !dueTasks.length) {
      return new Response(JSON.stringify({ skipped: "nothing due" }), { status: 200 });
    }

    webpush.setVapidDetails(
      Deno.env.get("VAPID_SUBJECT")!,
      Deno.env.get("VAPID_PUBLIC_KEY")!,
      Deno.env.get("VAPID_PRIVATE_KEY")!
    );

    let sent = 0;
    for (const task of dueTasks) {
      const { data: subs } = await supabase
        .from("push_subscriptions").select("*").eq("user_id", task.user_id);

      if (subs && subs.length) {
        const payload = JSON.stringify({
          title: "Reminder",
          body: task.title,
          url: Deno.env.get("APP_URL") || "./"
        });
        await Promise.allSettled(
          subs.map(sub => webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
            payload
          ).catch(async (err) => {
            if (err.statusCode === 410 || err.statusCode === 404) {
              await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
            }
            throw err;
          }))
        );
        sent++;
      }

      // Mark sent regardless of whether a subscription existed — a task
      // with no subscription will never gain one retroactively for this
      // exact reminder, so leaving reminder_sent = false would just
      // re-check it forever on every cron run for no benefit.
      await supabase.from("tasks").update({ reminder_sent: true }).eq("id", task.id);
    }

    return new Response(JSON.stringify({ checked: dueTasks.length, notified: sent }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 200 });
  }
});
