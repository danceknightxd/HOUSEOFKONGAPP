# Push Notifications — Setup Guide

Real, Messenger-style push notifications for alliance requests — they
reach the other person even if The Throne isn't open on their device.
No email, no domain verification needed (that was the old approach —
this one's genuinely simpler).

**How it works:** when someone enables notifications in Settings, their
browser generates a secure subscription and saves it to Supabase. When
a new alliance request comes in, a Database Webhook calls an Edge
Function, which pushes a real notification straight to their device
using the Web Push protocol — the same underlying tech Chrome/Firefox/
Edge notifications use everywhere.

This still needs the command line for one part (deploying the Edge
Function) — everything else is dashboard clicks.

---

## 1. Run the migration

In Supabase's SQL Editor, run `migration-push.sql` — creates the table
that stores each device's push subscription.

## 2. Install the Supabase CLI (skip if you already have it)

```bash
npm install -g supabase
```

## 3. Log in and link your project

```bash
supabase login
supabase link --project-ref gcoomsampafqlsoptqdw
```

## 4. Set your secrets

The VAPID keypair below is already generated and ready to use — the
public half is already sitting in `push-config.js`. Just set the
private half and a couple of details as Edge Function secrets:

```bash
supabase secrets set VAPID_PUBLIC_KEY=BCyXoh1mtOBP9scqt3_mfzTUW_pCASHsIMf8dZQC_4_u8DgDvt3RQQmA-GRmfEbtLu8aZBZXN5-Zu6A78m9xbBY
supabase secrets set VAPID_PRIVATE_KEY=siywqQbGBoXY5rV3fB4Zcbv-nJhmtVMMsI942lhNbow
supabase secrets set VAPID_SUBJECT=mailto:your-real-email@example.com
supabase secrets set APP_URL=https://danceknightxd.github.io/HOUSEOFKONGAPP/the-throne/
```

> The private key above is real and functional, generated specifically
> for this app — but since it's been written down in a document, treat
> it as not fully secret. If you want a fresh one only you've ever
> seen, run `npx web-push generate-vapid-keys` and use those instead —
> just remember to update the public half in `push-config.js` too if
> you do.

## 5. Deploy the function

```bash
supabase functions deploy notify-alliance
```

Copy the URL it prints out — you need it next.

---

## 6. Connect the webhook

1. Supabase dashboard → **Database** → **Webhooks**.
2. **Create a new webhook.**
3. **Table:** `alliances`
4. **Events:** **Insert** only.
5. **Type:** HTTP Request → paste the function URL from step 5.
6. **HTTP Headers:** `Authorization: Bearer YOUR_SUPABASE_ANON_KEY`
7. Save.

---

## 7. Turn it on for yourself

1. Open The Throne, go to **Settings**.
2. Click **Enable Notifications**.
3. Your browser will ask permission — allow it.

## 8. Test it

Send an alliance request from a second account to your main one. You
should get a real notification — even if The Throne is closed, as long
as your browser/OS allows background notifications for the site.

If nothing arrives: check **Supabase dashboard → Edge Functions →
notify-alliance → Logs** first — it'll show exactly what happened,
including whether the recipient even had a subscription saved.

---

## Extending this later

The same shape — webhook → Edge Function → push — works for anything
else you'd want a real notification for: an incoming Vault message, a
call, an alliance acceptance. Each would be its own small function
following this same pattern, reusing the `push_subscriptions` table
that's now in place.
