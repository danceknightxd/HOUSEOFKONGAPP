# Task Reminder Push Notifications — Setup Guide

Real push notifications when a task's reminder time arrives — same
underlying mechanism as alliance-request notifications
(`EDGE_FUNCTION_SETUP.md`), just triggered on a timer instead of a
database insert. If you've already set up push for alliances, most
of this is already done — you're just deploying one more function
and adding a schedule for it.

---

## 1. Run the migration

In Supabase's SQL Editor, run `migration-tasks-plus.sql` — adds
`reminder_at` / `reminder_sent` to `tasks`, plus the new `time_blocks`
table for the hour-grid feature.

## 2. Deploy the function

Two ways to do this — pick one. The dashboard route needs no local
tooling at all, so it's the one to reach for first if you'd rather
skip the CLI/Docker chain entirely.

### Option A — Dashboard (no install required)

1. Supabase Dashboard → your project → **Edge Functions** (left sidebar).
2. **Deploy a new function** → **Via Editor**.
3. Name it exactly `notify-task-reminder` (has to match what the cron
   job calls in step 4 below).
4. Delete the template code it starts you with.
5. Paste in the full contents of `notify-task-reminder.ts`.
6. Click **Deploy function**.

### Option B — CLI

Note: `npm install -g supabase` no longer works — Supabase dropped
support for global npm installs. Correct install commands:

- **Mac:** `brew install supabase/tap/supabase`
- **Windows (PowerShell):**
  ```
  scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
  scoop install supabase
  ```
- **Any OS via npm** (installs to the project folder, not globally —
  prefix every command below with `npx`):
  ```
  npm install -D supabase
  ```

Then:

```bash
supabase login
supabase link --project-ref gcoomsampafqlsoptqdw
supabase functions deploy notify-task-reminder
```

Newer CLI versions deploy through Supabase's API and don't need
Docker. If yours complains about a Docker daemon, add the flag:
`supabase functions deploy notify-task-reminder --use-api`.

### Either way — secrets

No new secrets needed if you already set up `notify-alliance` —
secrets are shared project-wide, not per-function. If you're starting
fresh with no push notifications set up at all, add these once under
**Edge Functions → Manage → Secrets**: `VAPID_PUBLIC_KEY`,
`VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `APP_URL` (values are in
`EDGE_FUNCTION_SETUP.md`).

## 3. Confirm it deployed

Supabase Dashboard → **Edge Functions** → you should see
`notify-task-reminder` listed with a recent deploy time.

## 4. Schedule it (this is the part that makes it actually run)

This function has to be *called* — nothing fires on its own.

1. Left sidebar → **Integrations** → **Cron**. (This moved recently —
   older accounts may show it under **Database** instead. Search
   "Cron" in the dashboard if you can't find it.)
2. First time here, click **Enable Cron** if prompted (a free,
   one-time toggle per project).
3. **Create a new Job**.
4. **Name:** `task-reminder-check`.
5. **Schedule:** `* * * * *` (every minute — or type "every minute"
   if there's a natural-language input).
6. **Job type:** choose **Supabase Edge Function** if that option
   exists — pick `notify-task-reminder` from the dropdown. This
   handles the auth header for you automatically.
   - If your dashboard only offers **HTTP Request** instead:
     **URL:** `https://gcoomsampafqlsoptqdw.supabase.co/functions/v1/notify-task-reminder`
     **Headers:** `Authorization: Bearer YOUR_SUPABASE_ANON_KEY`
7. Save.

Note pg_cron runs in **UTC** — doesn't matter for "every minute," but
worth knowing if you ever change the schedule to a specific time of day.

(If you'd rather do this in SQL instead of the dashboard, the
commented-out `pg_cron` block at the bottom of `migration-tasks-plus.sql`
does the same thing — uncomment it, fill in your anon key, and run it.)

## 5. Set a reminder to test it

1. Open The Throne → **Tasks** → add a task, or open an existing one.
2. Click the 🔔 on a task and set a time a couple minutes out.
3. Make sure notifications are enabled for your account (Settings →
   Enable Notifications — same toggle alliance notifications use).
4. Wait for the reminder time. You should get a push within a minute
   of it arriving (the cron job runs once a minute, so it's not
   instant-to-the-second).

If nothing arrives, check two places:
- **Integrations → Cron** → your job's run history — confirms the
  schedule itself is actually firing.
- **Edge Functions → notify-task-reminder → Logs** — confirms the
  function ran and shows whether it found the due task and a push
  subscription for you.
