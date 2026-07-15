# The Throne — House of Kong

An all-in-one dashboard: news, fitness, productivity, goals, social, and
encrypted messaging. No app store. No account. It's a folder of files you
run yourself.

## What's in this folder

```
index.html   → the app itself
config.js    → YOUR news/Blogger feeds go here
feeds.js     → the engine that fetches Blogger + RSS feeds
supabase-config.js → YOUR Supabase project URL + key go here
supabase-client.js → connects to Supabase
vault-crypto.js → real end-to-end encryption (Web Crypto API)
auth.js      → magic-link sign-in
sync.js      → tasks/goals/fitness/splits/social/Vault CRUD + realtime
spotify-config.js → YOUR Spotify app Client ID goes here
spotify.js   → real Spotify integration (PKCE OAuth, no backend needed)
schema.sql   → run once in Supabase to create your database
app.js       → wires everything to the screen
manifest.json → makes it installable (Add to Home Screen)
sw.js        → offline support
icon.svg / icon-192.png / icon-512.png → app icon
```

## 1. Set up Supabase (free tier — takes about 5 minutes)

1. Create a project at [supabase.com](https://supabase.com) (free tier is enough for personal use).
2. In your new project, go to **SQL Editor → New query**, paste in the
   entire contents of `schema.sql`, and run it. This creates every table
   (tasks, goals, fitness logs, Vault threads/messages) with security
   rules that make sure only you can see your own data, and only the
   two people in a conversation can see their Vault messages.
3. Go to **Authentication → Providers** and make sure **Email** is
   enabled (it is by default). Magic-link sign-in needs nothing else configured.
4. Go to **Project Settings → API** and copy your **Project URL** and
   **anon public** key into `supabase-config.js`.
5. Go to **Authentication → URL Configuration** and add the URL you'll
   be hosting this app at (e.g. `https://yourname.github.io/the-throne/`)
   to the **Redirect URLs** list — otherwise magic links won't return
   you to the app.

That's it — no server to run, no backend code to write. Supabase is
Postgres + auth + realtime, hosted for you.

## 2. Point news at your own feeds

Open `config.js` — same as before, this part doesn't touch Supabase.

Open `config.js`. Two sections:

- **`bloggerFeeds`** — your Blogger label feeds (projectdlab, emdexter,
  danceknightprime, etc.), same JSONP pattern you've used across the House
  of Kong index pages. Add/remove entries freely.
- **`topics`** — external news topics. Each one is a real RSS feed pulled
  through [rss2json.com](https://rss2json.com) (same service used in the
  "His World" index). Swap the `rss` URL for any feed. Set `enabled` to
  `true`/`false` to control what shows by default — this matches the topic
  chips in the News view.

No API key is required for light personal use. If you hit rate limits,
grab a free key from rss2json.com and drop it into `rss2jsonApiKey`.

## 3. Run it locally (fastest way to test)

From this folder:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080` in a browser. That's it — no build step,
no npm install.

## 4. Self-host it for real (free options)

Any static file host works, since this is plain HTML/CSS/JS:

- **GitHub Pages** — push this folder to a repo, enable Pages in repo
  settings, done. Free, and gives you a stable HTTPS URL (required for
  the service worker, "Add to Home Screen," and Supabase magic links).
- **Netlify / Vercel (free tier)** — drag-and-drop this folder in their
  dashboard, or connect the GitHub repo for auto-deploys on every push.
- **Your own server / NAS** — copy the folder into any web server root
  (nginx, Apache, Caddy). Works exactly the same.

Whichever you pick, remember to add that final URL to Supabase's
**Redirect URLs** (step 1.5 above), or magic-link sign-in will fail.

## 5. Install it like a native app

Once it's live on HTTPS:

- **Android / desktop Chrome/Edge** — visit the site, tap the "Install"
  icon in the address bar, or the browser menu's "Add to Home Screen."
- **iPhone/iPad (Safari)** — Share button → "Add to Home Screen."

It'll appear as its own icon, open full-screen with no browser chrome,
and keep working offline for anything already loaded (news feeds still
need a connection to refresh, by design — cached news isn't live news).

## How the Vault actually works

No custom crypto, no marketing terms — this is standard, real E2E encryption:

1. The first time you EVER open the app on any device, it generates an
   ECDH keypair using the browser's built-in Web Crypto API and asks you
   to **set a Vault passphrase**. That passphrase wraps (encrypts) your
   private key and uploads the wrapped blob to Supabase — the private
   key itself is never uploaded in readable form.
2. The public key gets uploaded to your `profiles` row unencrypted —
   that's safe, it's *meant* to be shared.
3. To message someone, enter their email in the Vault. The app looks up
   their public key, and both of you independently derive the same
   shared AES-256 key from ECDH math — Supabase never sees that key.
4. Every message is encrypted with AES-GCM before it leaves your browser.
   Supabase's database only ever stores ciphertext + an IV.

### Multi-device — now solved

Sign into a **second** device and it won't have a local key yet. Instead
of silently generating a new, disconnected identity, it detects your
account already has a Vault key and asks for your **passphrase** instead.
Enter it correctly and that device restores the exact same private key —
meaning it can now read every past conversation too, not just new ones.

This mirrors how real E2E systems handle key backup (a simpler version of
what Signal/WhatsApp do). The one thing to remember: **there is no
password reset for the passphrase** — it's derived client-side and never
sent anywhere in readable form, so if it's lost, that identity's message
history can't be recovered on a new device. That's the actual privacy
tradeoff, not a bug — a recoverable passphrase would mean Supabase (or
anyone with server access) could potentially reconstruct it too.

"Quantum encryption" isn't a real deployable consumer technology yet —
nothing here claims it. ECDH + AES-256-GCM is the real, current standard.

## Fitness logging

The Forge view reads and writes to the `fitness_logs` table:

- **Quick Log** — pick a metric (squat, bench, deadlift, sleep, resting
  HR, hydration, steps) and log a value. It syncs instantly and updates
  the Progressive Overload and Vitals bars, scaled against sensible
  default targets defined in `app.js` (`FITNESS_TARGETS`) — edit those
  constants to match your own goals.
- **Today's Ring** — logged separately as `daily_load_pct`, a 0–100
  self-rated training load for the day.
- **Recent Log** — last 8 entries across all metrics, newest first.

## Training splits & Spotify/Instagram setup

**Weekly splits** need nothing extra — they use the same Supabase project.
Click a day's status in the Forge view to cycle it through
upcoming → today → done → rest; first click on an unset day asks for a
label (PUSH, LEGS, REST, etc).

**Spotify** is a real, live connection — not a mockup:
1. Create a free app at [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard).
2. In that app's settings, add a **Redirect URI** that matches EXACTLY
   where you're hosting this (e.g. `https://yourname.github.io/the-throne/index.html`).
3. Copy the **Client ID** into `spotify-config.js`. No client secret
   needed — this uses PKCE, the OAuth flow built for apps that can't
   keep a secret safe (which describes any pure client-side app).
4. Click "Connect Spotify" in the Circle view. It'll show what's
   currently playing, live.

**Instagram is manual entry, on purpose — here's why:** Instagram's
Graph API requires exchanging a client secret server-side to get a
long-lived access token. A file you can open in a browser has no way to
keep that secret hidden — anyone could view-source it. Doing this
properly would mean standing up a small backend (an edge function or a
tiny server) just to hold that one secret and proxy the requests, which
is a meaningfully different project from "a folder of files you host
yourself." Logging posts manually in the Circle view keeps the whole
app honest about that limit instead of faking a live connection. If you
want the real auto-pull later, a Supabase Edge Function is the natural
place to put that secret — happy to build that out as its own step.

## Settings

The Settings view is now fully functional, not a placeholder:

- **Profile** — change your display name (shows up in the loading
  screen welcome message and to anyone you Vault-message).
- **Connected Services** — see Spotify's real connection status and
  disconnect from here as well as the Circle view.
- **Vault Security** — change your passphrase any time. This device
  already has your private key, so it just re-wraps it with the new
  passphrase and uploads the new wrapped blob — no need to enter the
  old one. Just remember: every *other* device still needs the new
  passphrase to unlock from now on; devices already unlocked stay
  unlocked without re-entering anything.
- **Your Data** — one-click export of everything (tasks, goals,
  fitness logs, splits, social posts, custom topics, portfolio) as a
  single JSON file. Vault messages are deliberately excluded from the
  export — they're encrypted and only meaningful decrypted inside the
  app itself.
- **Sign Out** — ends the session on this device only. Your Vault key
  stays in this device's storage, so signing back in later doesn't
  require restoring from your passphrase again on the *same* device.

## The Realm — your blog network as four Kingdoms

The Realm turns your House of Kong network into an in-app destination
instead of something you check separately:

- **The Forge Kingdom** — projectdlab (self-improvement, FORGE series), crimson-bronze accent
- **The Spire Kingdom** — emdexter (tech, AI), steel-blue accent
- **The Court Kingdom** — danceknightprime (K-pop, culture), rose accent
- **The Gallery Kingdom** — chimpmagnettrillionaireclub (art, visual work), emerald accent

Each Kingdom card is live — pulling its full feed via the same Blogger
JSONP pattern used elsewhere in the app, no separate setup needed since
it reuses your existing network. Tap a Kingdom to filter to just that
blog, or stay on "All Decrees" for a merged, newest-first feed across
all four. Edit the `kingdoms` array in `config.js` to add a fifth
Kingdom, rename any of them, or change accent colors.

## Alliances — a real friends list

Send a request by email, they accept or decline, and once connected
you can Message (opens a Vault chamber) or Call them directly — no
separate setup, it uses the same account system as everything else.
Backed by a proper `alliances` table with request/accept/decline states.

## Calling — real WebRTC video, "FaceTime for The Throne"

Tap **Call** on an ally, or the phone icon in an open Vault chamber, and
it starts a real peer-to-peer video call. How it works: Supabase's
Realtime *broadcast* feature (not a database table — ephemeral,
low-latency messages) carries the initial handshake — who's calling,
the session description, ICE candidates. Once connected, video and
audio flow directly between the two devices; Supabase never sees or
touches the actual call content.

**Honest limitation:** this uses a free public STUN server only, no
TURN server. That's enough for most home/office wifi and most mobile
connections, but a small number of strict corporate or carrier
networks block direct peer-to-peer connections outright, and calls
across those won't connect. Fixing that needs a TURN relay server,
which is a real ongoing cost (not a code change) — left out rather
than silently degrading without telling you. If this becomes a
dealbreaker, a paid TURN service (e.g. Twilio, Cloudflare) is a
drop-in addition to `webrtc.js`'s `RTC_CONFIG`.

## The King's Wing — Gallery, Message, Exhibitions

Three real integrations, one destination, each solved the way that
platform actually allows publicly rather than forcing OAuth where it
doesn't belong:

**King's Gallery** — the chimp_magnettrillionaireclub Instagram.
Instagram doesn't allow embedding a whole profile (blocked platform-
side), but individual posts embed live via Instagram's own official
widget — paste a post link, it renders the real post, no login needed.
This replaced the old manual caption/link/image entry, which is why
that's gone from the Circle view — one field instead of three, and
what you get back is the actual live post instead of typed-in details.

**King's Message** — the House of Kong podcast. Uses Spotify's own
iframe embed player pointed at the show — fully interactive, browse
and play every episode right there, zero OAuth required. Genuinely
simpler and better than the personal Spotify OAuth connection (which
still exists separately in the Circle view for your own listening).

**King's Art Exhibitions** — the Mansion and Penthouse OpenSea
collections. Live floor price, item count, and owner count via
OpenSea's public API. Works without a key at low request volume; add
a free one in `kings-config.js` if you hit rate limits.

Edit `kings-config.js` to change the Instagram handle, swap the
podcast show, or add/remove OpenSea collections.

## Productivity upgrade — inspired by Motion, RescueTime, and Forest

Researched what the best-in-class productivity apps actually do well
and pulled in the pieces that fit The Throne, adapted rather than copied:

- **Due dates + recurrence on tasks** — set a due date and repeat pattern
  (daily/weekdays/weekly) per task, same core idea as Motion's scheduling.
  Overdue tasks are flagged in red, today's in gold.
- **Daily Ritual template** — one click adds a starter set of 5 recurring
  daily tasks (morning review, two deep work blocks, training, evening
  review) instead of building your routine from scratch every day.
- **Real Focus Timer** — a genuine Pomodoro timer (25/15/50 min presets)
  tied to whichever task you click. Completing a session logs it to the
  new `focus_sessions` table — real time-tracking, RescueTime-style,
  not just a countdown that forgets everything when it hits zero.
- **Weekly Momentum bars are now real data**, not placeholders — Training
  pulls from your actual workout splits this week, Deep Work from logged
  focus session minutes, Tasks from your real completion rate, Sleep from
  average logged sleep_hours. Nearest Deadline shows whichever active goal
  is closest to done.

**If you already have a live Supabase project:** run `migration-productivity.sql`
once in the SQL Editor — it adds the new columns/table without touching
any existing data. (New installs get all of this automatically from the
main `schema.sql`.)

## Finance upgrade — inspired by Pearler

Looked at what Pearler's users actually praise most (per their own
reviews) and built the parts that are real and buildable without a
licensed broker integration:

- **Net Worth** — Pearler's most-loved feature: total wealth across
  everything, not just investments. Add cash/savings, property, super,
  or other assets manually, and it combines with your live crypto/stock
  portfolio into one real total.
- **Financial Independence tracker** — set your annual expenses, it
  calculates your FI Number using the standard 25× rule, and shows your
  real net worth's progress toward it as a ring, the same spirit as
  Pearler's goal-tracking.
- **Autoinvest Plans** — recurring contribution planning (weekly/
  fortnightly/monthly), linked to a specific holding if you want. This
  is a **planning and reminder tool, not real trade execution** — "Log
  Contribution" updates your own tracked quantity here; no real money
  or real trades move anywhere. Building actual automated investing
  needs a licensed broker integration (exactly what Pearler itself is),
  which is a fundamentally different, heavily-regulated kind of project
  than a self-hosted dashboard — flagged here rather than quietly faked.

**What I deliberately left out:** Pearler's round-up micro-investing
(rounding up card purchases) needs real bank transaction access via a
banking API (Plaid, Basiq, etc.), which means real financial
credentials flowing through the app — a meaningfully bigger trust and
security commitment than anything else here. Skipped rather than
built half-safely.

**If you already have a live Supabase project:** run
`migration-finance.sql` once in the SQL Editor.

## Budgeting upgrade — inspired by Goodbudget, GetReminded, Frollo

Markets is now split into two tabs: **Invest** (everything from before)
and **Budget** (new). Researched what real budgeting apps do well and
built the manual-first versions that don't need bank access:

- **Budget Envelopes** — Goodbudget's classic method. Set a monthly
  limit per category, log expenses against it as they happen, the bar
  turns red if you go over. Resets automatically each month since
  spending is calculated from real logged expenses, not a counter you
  have to remember to reset.
- **Bills & Subscriptions** — track recurring bills with a due day,
  see what's coming up soonest (highlighted when due within 5 days),
  mark paid, and see your real annual total across everything.
- **Savings Goals** — dollar-based goals with an optional target date
  (a house deposit, emergency fund, whatever) — distinct from the
  percentage-based Goals view, since "save $8,000" needs actual
  dollar tracking, not a vague progress percentage.

**Why manual, not bank-synced:** apps like Frollo and WeMoney auto-
categorize spending by connecting to your bank via Open Banking APIs.
That means real banking credentials flowing through the app — a
fundamentally bigger trust and security commitment than anything else
built here, and genuinely regulated territory. The envelope method
works well specifically *because* it's manual — it's the same reason
Goodbudget itself doesn't require bank access either.

**If you already have a live Supabase project:** run
`migration-budgeting.sql` once in the SQL Editor.

## Fitness upgrade — inspired by Boostcamp, Strong, Caliber

Researched what the highest-rated lifting apps actually do differently
from generic fitness trackers, and built the real, honest versions:

- **Workout Logger** — real per-exercise tracking (weight × reps × sets,
  optional RPE) instead of one generic daily number. This is the single
  biggest gap the old Fitness view had — Boostcamp/Strong/Caliber all
  win specifically on this.
- **Personal Records** — automatically detected from your logged sets,
  no manual PR entry. Log a heavier bench than ever before and it's
  flagged with a ★ right in your recent log.
- **Plate Calculator** — a genuinely useful utility every one of these
  apps includes: enter your target weight and bar weight, get the exact
  plates needed per side.

**If you already have a live Supabase project:** run
`migration-fitness.sql` once in the SQL Editor.

**What I left out, on purpose:** full multi-week structured programs
(like Boostcamp's template library) and push notification workout
reminders. Programs are a genuinely good next step, but need real
program content (a proper strength program is IP, not something to
improvise) — happy to build the structure once you know which program(s)
you actually want in it. Push notifications on a self-hosted PWA need a
web-push backend (VAPID keys + a server to trigger them), a real piece
of infrastructure rather than a quick addition.

## Feed thumbnails

News and Realm feed items now show real thumbnail images instead of a
generic icon — both feed sources already carried this data, it just
wasn't being pulled out:

- **Blogger (Realm/Kingdoms)** — uses Blogger's own `media$thumbnail`
  when a post has one, upsized from its tiny default crop; falls back
  to grabbing the first image out of the post content if no thumbnail
  field exists.
- **RSS (News topics)** — rss2json auto-extracts the article's lead
  image for most sources; used directly when present.

If a thumbnail URL ever breaks (deleted image, blocked hotlink, etc.)
it falls back to the original icon automatically rather than showing
a broken image icon.

## Push Notifications — Messenger-style, real OS notifications

Alliance requests now trigger a real push notification — reaches the
other person even if The Throne isn't open, the same way Messenger or
any native app notifies you. Turn it on in **Settings → Enable
Notifications**.

This needed one more piece of real infrastructure: a Supabase Edge
Function (small server-side code Supabase hosts for you) using the Web
Push protocol — the same tech every browser notification uses. Full
setup is in **`EDGE_FUNCTION_SETUP.md`**, including the one part that
needs a command line (deploying the function) rather than just SQL
Editor + file uploads like everything else.

**If you already have a live Supabase project:** run
`migration-push.sql` first, then follow `EDGE_FUNCTION_SETUP.md`.

## Markets — editable watchlist, currency, portfolio editing, detail view

Four real gaps closed:

- **Watchlist is now yours to edit** — no more hardcoded list in a config
  file. Add or remove crypto/stock symbols directly in the app, same
  spirit as custom news topics. Backed by a new `watchlist_items` table.
- **Display currency** — set yours in Settings (auto-detected from your
  browser's locale on first use, e.g. Australia → AUD). Crypto prices
  convert *for real* via CoinGecko's native multi-currency support —
  not just relabeled. Stocks show in their exchange's own listed
  currency (Twelve Data doesn't offer currency conversion, so an ASX
  stock shows AUD, a NASDAQ stock shows USD — labeled honestly rather
  than falsely converted). Manually-typed dollar amounts (budgets, net
  worth, bills) just relabel with the currency symbol, since there's no
  original currency to convert *from* — you typed them in whatever
  currency you meant.
- **Portfolio holdings are now editable** — click any holding to open
  its detail view, change the quantity, add/update your average price
  paid, or remove it entirely. `removeHolding` existed in the code from
  early on but was never actually wired to a button — now it is.
- **Real holding detail view** — click any watchlist card or portfolio
  holding for price, 24h change, a 30-day chart, and if it's in your
  portfolio: market value, avg. price paid, and real unrealized P&L.
  No Buy/Sell buttons — The Throne doesn't execute trades (see the
  Autoinvest section above for why), so those would be fake affordances
  that do nothing. Everything shown is real, nothing is decorative.

**If you already have a live Supabase project:** run
`migration-watchlist.sql` once in the SQL Editor.

## Tasks, Goals, and the date — three real gaps closed

- **Completed tasks now auto-clear 24 hours after being marked done** —
  and you can also remove any task manually at any time (✕ on each
  row), done or not. No more clutter piling up forever.
- **Goals are now actually editable** — a slider on each goal card lets
  you move progress up or down anytime, a "Mark Complete" shortcut
  jumps straight to 100%, and "Remove" deletes a goal you've abandoned
  or finished tracking. `updateGoalProgress` existed in the code since
  early on but was never wired to anything in the UI — now it is.
- **The date was hardcoded** — literally the text "TUE · JUL 07" typed
  into the HTML, never touched by any code, from the very first mockup.
  It's now computed live from the device's own local time, which
  naturally matches whatever country/timezone you're actually in — no
  geolocation needed, since that's just how a phone's clock already works.

**If you already have a live Supabase project:** run
`migration-watchlist.sql` again if you haven't already for this
session's changes — it now also adds the `completed_at` column tasks
need for the 24-hour auto-clear.

## Dashboard stat tiles — now actually linked (they weren't)

Good question that led to finding two more of the same bug: **Tasks
Cleared** and **Goals in Motion** on the Dashboard were hardcoded "6/9"
and "4" — completely disconnected from the real Tasks and Goals views.
**Vault Messages** had the same problem, and also exposed that unread
tracking didn't exist in the database at all yet.

All three are real now:
- **Tasks Cleared** — actual done/total count from your task queue,
  updates live the moment you check something off.
- **Goals in Motion** — real count of goals under 100%, with completed
  count shown below it.
- **Vault Messages** — genuine unread count. Opening a Vault thread now
  marks its messages read (new `read_at` column), so this number means
  something real instead of a static "2 unread" that never changed.

**If you already have a live Supabase project:** run
`migration-watchlist.sql` again — it's been updated to include the new
`read_at` column alongside this session's other additions. Every
statement in it is safe to re-run even if you ran an earlier version.

## Circle simplified

Removed **Log a Post** (the manual caption/link/image form) and
**Network Feed Status** from the Circle view. Both were leftovers from
before King's Gallery and The Realm existed with their own real,
live equivalents — Circle now just shows your personal Spotify
"now playing" and Your Feed, nothing decorative left around it.

## Liquid Glass — applied to overlay surfaces only

Four surfaces now use a gold-forward "smoked obsidian glass" treatment
— real `backdrop-filter: blur()` where there's genuine content behind
them to blur, plus a warm gold tint, edge-light sweep, and corner
glints:

- **Auth / Vault passphrase gate** — the sign-in and passphrase panels
- **Holding detail modal** — Markets' portfolio/watchlist detail view
- **Call overlay controls** — the button bar and incoming-call actions
  during a video call, genuinely blurring the live video feed behind them
- **Loading screen** — no real content sits behind this one (it's the
  very first thing shown), so it uses the same gold-glow language
  without a pointless blur-over-nothing

Deliberately **not** applied everywhere — the main app (Dashboard,
News, Forge, etc.) stays fully opaque black. Liquid Glass only makes
sense for things floating *above* the throne room; the throne room
itself should feel solid, not see-through.

## What's still a UI shell (not wired up)

**Tasks, Goals, Fitness, Training Splits, News (including custom
typed topics), Vault (multi-device), Spotify, and Markets/Portfolio
are all fully live.** Instagram auto-pull is the one deliberate
exception, for the server-secret reason above.

## App icon & welcome screen

- The app icon is your uploaded artwork, processed into every size
  Android/iOS actually need (`icon-192.png`, `icon-512.png`,
  `icon-512-maskable.png` for Android's adaptive-icon crop safe zone,
  and `icon-192-apple.png` for iOS). Swap any of these files for your
  own art later without touching code.
- On load, a full-screen loading screen shows the crest and, once your
  session is confirmed, a personalized "Welcome back, {name}" pulled
  from your profile — before the dashboard itself appears.
- Your display name defaults to the part of your email before the @.
  To change it, run `update profiles set display_name = 'Your Name'
  where email = 'you@example.com';` in Supabase's SQL Editor (a proper
  Settings-page field for this is a small future addition).

## Custom news topics

Beyond the starter topics in `config.js`, you can type ANY topic
directly in the News view — "soccer," "K-pop," "AI," anything — and it
adds a live feed pulled from Google News' public search RSS (no API
key needed). It's saved to your account via the `news_topics` table,
so it's there on every device you sign into. Click a custom topic chip
again to remove it.

## Markets & Portfolio

The Treasury view has two parts:

- **Watchlist** — a few headline tickers (edit `MARKET_CONFIG.watchlist`
  in `market-config.js`), crypto via CoinGecko (free, no key, live),
  stocks via Twelve Data (free tier, needs a key — sign up at
  twelvedata.com and paste it into `market-config.js`; leave blank and
  it shows an honest "add a key" card instead of fake numbers).
- **Portfolio** — add real holdings (crypto by CoinGecko id like
  `bitcoin`, or stock ticker like `AAPL`) with a quantity, and it shows
  live total value. Click any watchlist card or portfolio holding to
  chart its price history (30 days) using Chart.js.

This is your own data, displayed — not financial advice.




