# X / Twitter Feed — Setup Guide

Straight talk first: **X's API has no free tier as of February 2026.** Every
developer, new or old, is on pay-per-use pricing — reading tweets costs
about $0.005 each, with no free monthly allowance to prototype against.
There used to be a free tier; X discontinued it. This isn't something
this app can work around — it's how X's API is priced now, period.

Rough cost for personal use: searching a topic for 10 results costs
~$0.05; following an account and refreshing its latest 10 tweets
costs the same. Casual use (a few searches/refreshes a day) likely
runs a few dollars a month. Heavy use adds up fast — there's no cap
protecting you from your own usage other than the spending limit you
set on your X developer account.

If that's a dealbreaker, the YouTube feed above it works the same way
but is free (topic search uses YouTube's free API tier; following a
channel is entirely keyless) — you can use just that and skip this
section, the UI simply shows nothing added under X until it's configured.

---

## 1. Get an X developer account + Bearer Token

1. Go to [developer.x.com](https://developer.x.com) and sign up for a
   developer account if you don't have one.
2. Create a Project and an App inside it.
3. In the App's **Keys and Tokens** tab, generate a **Bearer Token**
   (this is the "App-Only" token — it's the one this app needs; you
   don't need the API Key/Secret or Access Token pair for read-only
   use like this).
4. Set a spending limit on your account (X's dashboard has this under
   billing) so a bug or unexpectedly heavy use can't run away on you.

## 2. Run the migration

In Supabase's SQL Editor, run `migration-social-follows.sql` — creates
the table that stores which YouTube channels and X accounts you follow.

## 3. Deploy the proxy function

This has to be a server-side function, not a client config file — the
Bearer Token is a paid, metered credential, and putting it in a
client-visible file (like every other key in this app) would let
anyone who found it in your page source run up charges on your
account. This function keeps it as a secret only it can read.

**Dashboard (no install required):**
1. Supabase Dashboard → your project → **Edge Functions**.
2. **Deploy a new function** → **Via Editor**.
3. Name it exactly `x-search-proxy`.
4. Delete the template code, paste in the full contents of `x-search-proxy.ts`.
5. Click **Deploy function**.

**Or via CLI** (see `EDGE_FUNCTION_SETUP.md` for install steps if you
don't have it yet):
```bash
supabase functions deploy x-search-proxy
```

## 4. Set the secret

**Dashboard:** Edge Functions → Manage → Secrets → add
`X_BEARER_TOKEN` with the value from step 1.

**Or CLI:**
```bash
supabase secrets set X_BEARER_TOKEN=your-bearer-token-here
```

## 5. Try it

Open The Throne → **Your Feed**, scroll to the X/Twitter panel, and
either search a topic or follow an @account. If nothing shows up,
check **Edge Functions → x-search-proxy → Logs** — it'll show the
exact error X's API returned (a common one early on is the app not
having the right access level for recent search or user timelines —
X's dashboard shows which endpoints your app tier includes).
