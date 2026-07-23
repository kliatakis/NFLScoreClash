# ScoreClash (NFL) 🏈

NFL full-season (regular season + playoffs, no preseason) prediction league app.
A new, independent project — not connected to the original ScoreClash (World Cup)
app or its Firebase project in any way.

## ⚠️ Before you deploy — two things need real data filled in

1. **`src/firebase.js`** — paste in your own Firebase project config (see Step 1 below).
2. **`src/data/fixtures.js`** — only a handful of independently-confirmed marquee
   games (season opener, Thanksgiving, Christmas, playoff dates) are seeded.
   The other ~260 regular-season matchups need to be transcribed from the
   official schedule (nfl.com/schedules) into `REGULAR_SEASON_FIXTURES`,
   following the same object shape. Playoff matchups are deliberately left
   empty — they can't be known until seeding is determined; the league admin
   enters each round's real games from the app's admin panel once they are.

## What's different from the original ScoreClash build

- **Storage**: leagues and predictions are now Firestore *collections* (one
  small doc per league / per user), not single mega-documents. This is what
  lets it scale past ~30 users — the old design would have hit Firestore's
  1MB-per-document hard limit well before 500 users for a full NFL season.
- **Predictions are shared across leagues.** Enter a pick for a game once;
  it scores against every league you're in (each league can still have its
  own point values).
- **Multi-admin leagues**: a permanent super admin (creator) can promote
  other members to admin (result entry, overrides, kicks, scoring settings).
  Only the super admin can delete the league.
- **Admin overrides** are visibly flagged with an asterisk to the affected user.
- **"What's new since you last logged in"** is now tracked on the account
  (Firestore), not localStorage — identical across every device.
- **Results fetching** uses ESPN's free public scoreboard endpoint instead of
  a paid API — the original build needed a paid API-Football plan because
  its free tier excludes the current season; ESPN's endpoint has no such
  restriction, at the cost of being unofficial/undocumented.
- **Rise/fall arrows** on the league table are shared (everyone sees the same
  arrows) and update whenever a result or an admin override changes the
  standings — not per-device, per-login state.
- **No team logos** — team colors + an emoji badge instead, to avoid
  trademark risk on official NFL/team logo images.

## Deployment Guide

### Step 1 — Create a new Firebase project

1. Go to [Firebase Console](https://console.firebase.google.com) → **Add project**
2. Enable **Firestore Database** and **Authentication → Email/Password**
3. Copy your web app config into `src/firebase.js` (replace the `REPLACE_ME` placeholders)
4. In Firestore → Rules, paste the contents of `firestore.rules` and publish

### Step 2 — Results auto-fetch (optional but recommended)

No API key needed for ESPN's endpoint. Just set a `CRON_SECRET` environment
variable in Vercel (any random string) so the daily cron can authenticate —
the admin's in-app "Fetch Latest Results" button works without it too.

### Step 3 — Deploy to Vercel

```bash
npm install -g vercel
cd gridclash-app
npm install
vercel
```

Vercel auto-detects Vite. The cron in `vercel.json` runs the results fetch daily.

## Local development

```bash
npm install
npm run dev
```

## Tech stack

- React 18 + Vite
- Firebase Firestore (real-time database) + Firebase Auth
- ESPN public scoreboard endpoint (results) — no paid API required
