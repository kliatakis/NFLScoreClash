# Resetting ScoreClash to a clean slate

Wipes every account, league, prediction and result so the app behaves as if it
had just been deployed. Takes about five minutes.

**This is irreversible.** There is no undo.

Before you start: open any league you administer → **Admin Panel → Backup → Download
backup**. That gives you a JSON file of every pick and result, which you can restore from
the same panel if you wipe something you meant to keep.

---

## What actually holds data

Everything lives in two places, and you have to clear **both** — this is the
part that catches people out.

| Where | What's in it | How to clear |
|---|---|---|
| **Firestore** — `users` | Profile: username, avatar, timezone, last login | Delete collection |
| **Firestore** — `usernames` | The uniqueness index (one doc per claimed name) | Delete collection |
| **Firestore** — `leagues` | Leagues, members, scoring settings, standings snapshots | Delete collection |
| **Firestore** — `predictions` | One doc per user: every game pick and season pick | Delete collection |
| **Firestore** — `results` | One doc, `results_2026`: all scores, special results, playoff matchups | Delete collection |
| **Authentication** | The actual login accounts (email + password) | Delete users |

Firestore holds the *data*; Authentication holds the *logins*. Clearing only
Firestore leaves people able to sign in to an account with no profile — the app
will look broken for them rather than fresh.

---

## Step 1 — Firestore

1. [Firebase Console](https://console.firebase.google.com/) → your project → **Firestore Database**
2. For each of the five collections above:
   - Click the collection name in the left column
   - Click the **⋮** menu next to the collection name
   - **Delete collection**
   - Type the collection name to confirm

Delete all five: `users`, `usernames`, `leagues`, `predictions`, `results`.

The console deletes in batches and may need a moment on `predictions` if you've
had a few testers. If a collection reappears looking half-empty, refresh — it's
usually the console lagging, not a failed delete.

## Step 2 — Authentication

1. Same project → **Authentication** → **Users** tab
2. Tick the checkbox at the top of the list to select every user
3. **Delete account**

If you want to keep your own login, deselect yourself here — but then also
recreate your profile, because Step 1 removed it. Cleaner to delete everything
and re-register.

## Step 3 — Check the rules are still published

Deleting collections doesn't touch security rules, but this is a good moment to
confirm the `usernames` rule is live, since registration fails without it:

Firestore → **Rules** tab → confirm you can see:

```
match /usernames/{name} {
```

If it isn't there, paste in the contents of `firestore.rules` from this project
and click **Publish**.

## Step 4 — Verify

1. Open the app in a private/incognito window
2. Register a fresh account — it should accept the username without complaint
3. You should land on an empty dashboard with no leagues
4. Create a league; the standings should show only you, on 0 points

If registration says *"Missing or insufficient permissions"*, Step 3 is the
problem — the rules weren't published.

---

## Notes

**Results come back on their own.** The Vercel cron re-fetches finished NFL
games once a day. Before the season starts there's nothing to fetch, so
`results` will stay empty. Once the season is running, clearing `results` only
clears it until the next fetch. Not an issue for pre-season testing.

**Season picks lock at kickoff and don't reopen.** After 10 September 2026 a
reset is the only way to re-test the season-pick flow.

**Deleting from inside the app doesn't do the same thing.** Profile → Delete
Account removes one user cleanly (profile, username claim, predictions, league
memberships). It's the right tool for removing one tester; it's the slow way to
remove twenty.

**Individual documents can be deleted instead of whole collections** if you
want to keep some data — e.g. delete `predictions/{uid}` for one tester while
leaving the league intact. The document ID is that user's Auth UID, which you
can copy from the Authentication tab.
