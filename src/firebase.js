import { initializeApp } from "firebase/app";
import {
  getFirestore,
  doc, getDoc, setDoc, updateDoc, deleteDoc, deleteField, onSnapshot,
  collection, getDocs, query, where, orderBy, limit, addDoc,
  arrayUnion, arrayRemove, FieldPath,
} from "firebase/firestore";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  onAuthStateChanged,
  EmailAuthProvider,
  reauthenticateWithCredential,
  deleteUser,
  updatePassword,
  updateEmail,
} from "firebase/auth";
import { SEASON, isPreseasonFixture } from "./data/fixtures.js";

// ─── Firebase project config ────────────────────────────────────────────────
//
// The keys now live in their own file, src/firebaseConfig.js, and NOT here.
//
// They used to be right at the top of this file, which made every update a
// hazard: this file changes whenever a feature needs a new query, so it gets
// re-uploaded — and re-uploading it silently replaced a working config with
// placeholders. The build still passes, the deploy still succeeds, and the
// site fails at runtime with nothing obvious to point at.
//
// Upload src/firebaseConfig.js once. Never again.
import { firebaseConfig, isFirebaseConfigured } from "./firebaseConfig.js";

if (!isFirebaseConfigured) {
  // Thrown deliberately, at module load, before anything can half-work. The
  // watchdog in index.html catches it and puts this text on the screen — the
  // alternative is auth calls that hang forever behind a blank page.
  throw new Error(
    "Firebase isn't configured. Open src/firebaseConfig.js and replace the "
    + "REPLACE_ME values with your project's config from the Firebase console "
    + "(Project settings → General → Your apps → SDK setup and configuration)."
  );
}

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

const RESULTS_DOC_ID = `results_${SEASON.year}`;

// ══════════════════════════════════════════════════════════════════════════
// USERS — one doc per person: profile, avatar, and per-account "last seen"
// markers (fixes the old app's localStorage/per-device bug — this data now
// lives on the account, so it's identical no matter which device logs in).
// ══════════════════════════════════════════════════════════════════════════

export async function fsReadUser(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

export async function fsWriteUser(uid, profile) {
  await setDoc(doc(db, "users", uid), profile, { merge: true });
}

export async function fsDeleteUser(uid) {
  await deleteDoc(doc(db, "users", uid));
}

export function fsSubscribeUser(uid, callback) {
  return onSnapshot(doc(db, "users", uid), (snap) => callback(snap.exists() ? snap.data() : null));
}

// All user profiles, live — used to resolve uid -> username/avatar everywhere.
export function fsSubscribeAllUsers(callback) {
  return onSnapshot(collection(db, "users"), (snap) => {
    const users = {};
    snap.forEach(d => { users[d.id] = d.data(); });
    callback(users);
  });
}

export async function fsGetAllUsers() {
  const snap = await getDocs(collection(db, "users"));
  const users = {};
  snap.forEach(d => { users[d.id] = d.data(); });
  return users;
}

// ══════════════════════════════════════════════════════════════════════════
// USERNAME CLAIMS — usernames/{lowercased name} -> { uid }
//
// A tiny separate collection purely so display names can be kept unique.
//
// It exists because of an ordering problem that broke registration outright:
// the sign-up form has to answer "is this name free?" BEFORE the account is
// created, so at that moment there is no signed-in user — and the `users`
// collection is (correctly) readable only by signed-in users. Checking
// uniqueness by scanning `users` therefore always failed with "Missing or
// insufficient permissions" and no one could register at all.
//
// This collection is deliberately world-readable, which is safe because it
// holds nothing but a name -> uid mapping: no emails, no profile data, no
// predictions. Writes stay locked down — see firestore.rules, where only
// `create` and owner-`delete` are permitted and `update` never is, so an
// existing claim can't be hijacked.
// ══════════════════════════════════════════════════════════════════════════

const usernameKey = (name) => String(name || "").trim().toLowerCase();

export const USERNAME_MAX = 20;

// Validates a username BEFORE it's used as a Firestore document id.
//
// This isn't cosmetic. The lowercased name becomes the id of a doc in
// `usernames`, and Firestore rejects ids containing "/" or equal to "." or
// ".." — so a name like "a/b" made getDoc throw, which surfaced as a raw
// SDK error mid-signup. The character allowlist sidesteps all of that, and
// the length cap stops a 200-character name wrecking the standings table.
// Returns an error string, or null when the name is fine.
export function validateUsername(name) {
  const trimmed = String(name || "").trim();
  if (trimmed.length < 3) return "Username must be at least 3 characters.";
  if (trimmed.length > USERNAME_MAX) return `Username can be at most ${USERNAME_MAX} characters.`;
  if (!/^[A-Za-z0-9 _-]+$/.test(trimmed)) return "Use only letters, numbers, spaces, hyphens and underscores.";
  if (!/[A-Za-z0-9]/.test(trimmed)) return "Username needs at least one letter or number.";
  if (/\s{2,}/.test(trimmed)) return "Username can't contain double spaces.";
  return null;
}

export async function fsIsUsernameTaken(username, excludeUid) {
  const key = usernameKey(username);
  if (!key) return false;
  const snap = await getDoc(doc(db, "usernames", key));
  if (!snap.exists()) return false;
  return snap.data()?.uid !== excludeUid; // your own name isn't "taken"
}

// Claims a name for a uid, releasing the previous one if given. Throws if
// somebody else already holds it. Safe to call repeatedly with a name you
// already own — it just no-ops, which is what lets existing accounts
// back-fill their claim on next login.
export async function fsClaimUsername(uid, username, previousUsername = null) {
  const key = usernameKey(username);
  if (!key) return;
  const ref = doc(db, "usernames", key);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    if (snap.data()?.uid === uid) return;
    throw new Error("That username is taken — pick another.");
  }
  await setDoc(ref, { uid });

  const prevKey = usernameKey(previousUsername);
  if (prevKey && prevKey !== key) {
    await deleteDoc(doc(db, "usernames", prevKey)).catch(() => {});
  }
}

export async function fsReleaseUsername(username) {
  const key = usernameKey(username);
  if (!key) return;
  await deleteDoc(doc(db, "usernames", key)).catch(() => {});
}

// Record "you were last here at time T" on the account itself. Called once
// per login. Returns the PREVIOUS lastLoginAt (before overwriting it) so the
// caller can diff "what changed since then" — the whole point of the fix.
export async function fsRecordLoginAndGetPrevious(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  const prev = snap.exists() ? snap.data().lastLoginAt || null : null;
  await setDoc(ref, { lastLoginAt: Date.now() }, { merge: true });
  return prev;
}

// ══════════════════════════════════════════════════════════════════════════
// BACKUP / RESTORE
//
// The decision-making lives in lib/backup.js as pure functions. These two do
// nothing but read everything, and execute a plan that has already been
// computed and shown to the person. Keeping them dumb is the point: there is
// no branch in here that could quietly write something the preview didn't
// mention.
// ══════════════════════════════════════════════════════════════════════════

// One full read of everything worth keeping. Used both to build a backup file
// and to work out what a restore would actually change.
//
// `includeHistory` is off by default and on only when building a file to
// download. The restore PREVIEW calls this too, and the change history has no
// bearing on what a restore would write — reading a few hundred extra
// documents every time someone re-previews would be pure waste.
export async function fsReadEverything({ includeHistory = false } = {}) {
  const [usersSnap, leaguesSnap, predsSnap, resultsSnap, auditLog] = await Promise.all([
    getDocs(collection(db, "users")),
    getDocs(collection(db, "leagues")),
    getDocs(collection(db, "predictions")),
    getDoc(doc(db, "results", RESULTS_DOC_ID)),
    // Never fatal: a project whose rules haven't been republished yet would
    // reject this read, and a backup without the history is far better than
    // no backup at all.
    includeHistory ? fsGetAuditLog().catch(err => {
      console.error("Couldn't include the change history in this backup", err);
      return [];
    }) : Promise.resolve([]),
  ]);
  const users = {}; usersSnap.forEach(d => { users[d.id] = d.data(); });
  const leagues = []; leaguesSnap.forEach(d => leagues.push(d.data()));
  const predictions = {}; predsSnap.forEach(d => { predictions[d.id] = d.data(); });
  const raw = resultsSnap.exists() ? resultsSnap.data() : {};
  return {
    users, leagues, predictions, auditLog,
    results: {
      scores: raw.scores || {},
      specials: raw.specials || {},
      playoffFixtures: raw.playoffFixtures || {},
    },
  };
}

// Applies a plan from planRestore(). Writes are attempted individually and
// failures are collected rather than thrown, so one rejected document (a
// permissions edge, say) can't abandon the restore half-done with no report
// of what did and didn't land.
export async function fsApplyRestorePlan(plan) {
  const done = [], failed = [];
  const run = async (label, fn) => {
    try { await fn(); done.push(label); }
    catch (err) { console.error("Restore step failed:", label, err); failed.push({ label, message: err?.message || String(err) }); }
  };

  if (plan.results) {
    const ref = doc(db, "results", RESULTS_DOC_ID);
    await run("results", () => (
      plan.results.type === "set"
        ? setDoc(ref, plan.results.doc)
        // setDoc with merge, not updateDoc: the document may not exist at all
        // if this is a restore into an empty project, and updateDoc throws in
        // that case. The keys are dotted field paths either way.
        : setDoc(ref, dottedToNested(plan.results.doc), { merge: true })
    ));
  }
  for (const item of plan.predictions) {
    const ref = doc(db, "predictions", item.uid);
    await run(`predictions/${item.uid}`, () => (
      item.type === "set" ? setDoc(ref, item.doc) : setDoc(ref, dottedToNested(item.doc), { merge: true })
    ));
  }
  for (const item of plan.leagues) {
    const ref = doc(db, "leagues", item.id);
    await run(`leagues/${item.id}`, () => (
      item.type === "set" ? setDoc(ref, item.doc) : setDoc(ref, item.doc, { merge: true })
    ));
  }
  return { done, failed };
}

// { "scores.w1_1": v } -> { scores: { w1_1: v } }
//
// Needed because the plan speaks in field paths (which is the natural way to
// express "only touch these keys") while setDoc-with-merge wants a nested
// object. Splitting on the FIRST dot only: fixture ids never contain one, and
// a naive full split would mangle any key that did.
function dottedToNested(fields) {
  const out = {};
  for (const [path, value] of Object.entries(fields)) {
    const i = path.indexOf(".");
    if (i === -1) { out[path] = value; continue; }
    const head = path.slice(0, i), tail = path.slice(i + 1);
    (out[head] ||= {})[tail] = value;
  }
  return out;
}

// ══════════════════════════════════════════════════════════════════════════
// LEAGUES — one doc per league (collection, not a single mega-doc). Queried
// with array-contains so "my leagues" scales independently of total league
// count in the app.
// ══════════════════════════════════════════════════════════════════════════

// Toggles the caller's reaction on one announcement-board row.
//
// Stored on the league doc under `reactions.<rowKey>.<emoji>` as an array of
// uids, so a row's whole state is one small map and the board can render from
// the league subscription it already has — no extra collection, no extra read.
// `rowKey` encodes week + category + subject so it stays stable across
// re-renders and week switches (see HighlightsCard).
export async function fsToggleReaction(leagueId, rowKey, emoji, uid, isOn) {
  if (!leagueId || !uid) return;
  // FieldPath, not a dotted string: `rowKey` contains ":" separators and the
  // final segment is an emoji, both of which a dotted path would try to parse.
  // FieldPath takes segments literally.
  const path = new FieldPath("reactions", rowKey, emoji);
  // arrayUnion/arrayRemove rather than read-modify-write. Two people reacting
  // to the same row at the same moment would otherwise race, and whichever
  // write landed second would erase the other. These are atomic server-side
  // and need no read at all.
  await updateDoc(doc(db, "leagues", leagueId), path, isOn ? arrayRemove(uid) : arrayUnion(uid));
}

// Creates a league under a randomly generated code.
//
// The existence check matters: the code IS the document id, so a plain setDoc
// on a code that happened to already exist would silently overwrite a real
// league — deleting its members, settings and history. A collision is very
// unlikely (36^6 ≈ 2.2 billion codes) but the consequence is total data loss
// for that league, so it's worth the extra read.
export async function fsCreateLeague(league) {
  const ref = doc(db, "leagues", league.id);
  const existing = await getDoc(ref);
  if (existing.exists()) {
    const err = new Error("league-code-collision");
    err.code = "league-code-collision";
    throw err;
  }
  await setDoc(ref, league);
}

export async function fsGetLeague(leagueId) {
  const snap = await getDoc(doc(db, "leagues", leagueId));
  return snap.exists() ? snap.data() : null;
}

export function fsSubscribeLeague(leagueId, callback) {
  return onSnapshot(doc(db, "leagues", leagueId), (snap) => callback(snap.exists() ? snap.data() : null));
}

// Live "my leagues" — a query, not a full-collection fetch, so it scales
// regardless of how many leagues exist app-wide.
export function fsSubscribeMyLeagues(uid, callback) {
  const q = query(collection(db, "leagues"), where("members", "array-contains", uid));
  return onSnapshot(q, (snap) => {
    const leagues = [];
    snap.forEach(d => leagues.push(d.data()));
    callback(leagues);
  });
}

export async function fsUpdateLeague(leagueId, patch) {
  await updateDoc(doc(db, "leagues", leagueId), patch);
}

export async function fsDeleteLeague(leagueId) {
  await deleteDoc(doc(db, "leagues", leagueId));
}

export async function fsAddLeagueMember(leagueId, uid) {
  await updateDoc(doc(db, "leagues", leagueId), { members: arrayUnion(uid) });
}

export async function fsRemoveLeagueMember(leagueId, uid) {
  await updateDoc(doc(db, "leagues", leagueId), {
    members: arrayRemove(uid),
    adminIds: arrayRemove(uid),
  });
}

// Same write as fsRemoveLeagueMember, but called by a member on themselves
// (voluntarily leaving) rather than by an admin kicking someone else. Kept
// as a separate function for clarity at call sites even though the
// underlying write is identical — the Firestore rule that permits this is
// also its own dedicated branch (only the super admin can't use it; they
// use Danger Zone -> Delete League instead).
export async function fsLeaveLeague(leagueId, uid) {
  await updateDoc(doc(db, "leagues", leagueId), {
    members: arrayRemove(uid),
    adminIds: arrayRemove(uid),
  });
}

export async function fsSetLeagueAdmins(leagueId, adminIds) {
  await updateDoc(doc(db, "leagues", leagueId), { adminIds });
}

// Persisted standings snapshots used for the rise/fall arrows — shared, so
// every viewer sees the same arrows regardless of device or login. Two
// generations are stored (see calcStandingsWithMovement in lib/scoring.js
// for why): `standingsSnapshot` is the stable baseline actually used for
// display, `standingsTrackedSnapshot` is internal bookkeeping for detecting
// the *next* change.
export async function fsSaveLeagueStandingsSnapshot(leagueId, snapshot, version, trackedSnapshot, trackedVersion) {
  await updateDoc(doc(db, "leagues", leagueId), {
    standingsSnapshot: snapshot,
    standingsSnapshotVersion: version,
    standingsTrackedSnapshot: trackedSnapshot,
    standingsTrackedVersion: trackedVersion,
  });
}

// ══════════════════════════════════════════════════════════════════════════
// PREDICTIONS — one doc per user (NOT per user-per-league). A pick is shared
// across every league that person is in; only the scoring differs per league.
// ══════════════════════════════════════════════════════════════════════════

export async function fsGetPredictions(uid) {
  const snap = await getDoc(doc(db, "predictions", uid));
  return snap.exists() ? snap.data() : { picks: {}, specials: {} };
}

export function fsSubscribePredictions(uid, callback) {
  return onSnapshot(doc(db, "predictions", uid), (snap) =>
    callback(snap.exists() ? snap.data() : { picks: {}, specials: {} })
  );
}

// All predictions docs, live — needed for league standings (reads one small
// doc per league member, via the members list — see lib/scoring.js).
export function fsSubscribeAllPredictions(callback) {
  return onSnapshot(collection(db, "predictions"), (snap) => {
    const preds = {};
    snap.forEach(d => { preds[d.id] = d.data(); });
    callback(preds);
  });
}

// A pick is just a side: "H" home, "A" away, "T" tie.
export async function fsSaveGamePrediction(uid, fixtureId, winner) {
  await setDoc(doc(db, "predictions", uid), {
    picks: { [fixtureId]: { winner } },
  }, { merge: true });
}

// Saves a whole batch of game predictions in ONE write.
//
// Entering a week one row at a time was both tedious and 16 separate writes;
// Firestore merges nested maps, so the entire week goes in a single request.
// `winners` is { fixtureId: "H" | "A" | "T" }.
export async function fsSaveGamePredictions(uid, winners) {
  const entries = Object.entries(winners || {});
  if (entries.length === 0) return;
  const payload = {};
  for (const [fixtureId, winner] of entries) payload[fixtureId] = { winner };
  await setDoc(doc(db, "predictions", uid), { picks: payload }, { merge: true });
}

// Removes specific predictions — one field-path delete per fixture, in a
// single update, leaving every other pick untouched.
export async function fsClearGamePredictions(uid, fixtureIds) {
  const ids = (fixtureIds || []).filter(Boolean);
  if (ids.length === 0) return;
  const payload = {};
  for (const id of ids) payload[`picks.${id}`] = deleteField();
  try {
    await updateDoc(doc(db, "predictions", uid), payload);
  } catch (err) {
    // updateDoc throws if the document doesn't exist yet — which happens to a
    // brand-new account whose first tap failed to save and who then taps again
    // to undo it. There's nothing stored to remove, so that's already the
    // desired end state; surfacing it as a save error would be a lie.
    if (err?.code === "not-found") return;
    throw err;
  }
}

export async function fsSaveSpecialPick(uid, pickId, teamCode) {
  await setDoc(doc(db, "predictions", uid), {
    specials: { [pickId]: teamCode },
  }, { merge: true });
}

// Admin override — same write path, but tags who changed it and when so the
// UI can show the "corrected by an admin" asterisk.
export async function fsAdminOverrideGamePrediction(targetUid, fixtureId, winner, adminUid) {
  await setDoc(doc(db, "predictions", targetUid), {
    picks: {
      [fixtureId]: {
        winner,                 // "H" | "A" | "T"
        // Wipe any scoreline left over from before the winner-only switch, so
        // the corrected pick can't be read back through the legacy path.
        homeScore: deleteField(),
        awayScore: deleteField(),
        overriddenBy: adminUid,
        overriddenAt: Date.now(),
      },
    },
  }, { merge: true });
}

// Puts a pick back to a plain, un-corrected state.
//
// Used only by undo. fsAdminOverrideGamePrediction stamps `overriddenBy`, and
// a merge write can't remove a field — so undoing an override with that
// function restored the right team but left the "*corrected" asterisk on it.
// The member's own pick would sit there flagged as having been changed by an
// admin, which is the opposite of the truth.
export async function fsRestoreGamePrediction(uid, fixtureId, winner) {
  await setDoc(doc(db, "predictions", uid), {
    picks: {
      [fixtureId]: {
        winner,
        overriddenBy: deleteField(),
        overriddenAt: deleteField(),
        homeScore: deleteField(),
        awayScore: deleteField(),
      },
    },
  }, { merge: true });
}

// ══════════════════════════════════════════════════════════════════════════
// RESULTS — one small doc for the whole season (fine as a single doc: size
// scales with game count (~285), not with user count).
// ══════════════════════════════════════════════════════════════════════════

export async function fsGetResults() {
  const snap = await getDoc(doc(db, "results", RESULTS_DOC_ID));
  return snap.exists() ? snap.data().scores || {} : {};
}

export function fsSubscribeResults(callback) {
  return onSnapshot(doc(db, "results", RESULTS_DOC_ID), (snap) =>
    callback(snap.exists() ? snap.data().scores || {} : {})
  );
}

export async function fsSetResult(fixtureId, homeScore, awayScore) {
  await setDoc(doc(db, "results", RESULTS_DOC_ID), {
    // enteredAt powers the account-wide "what's new since you last logged
    // in" banner (see DashboardTab) — it's a timestamp on the result itself,
    // not on any one viewer's device, so it reads the same for everyone.
    scores: { [fixtureId]: { homeScore: Number(homeScore), awayScore: Number(awayScore), enteredAt: Date.now() } },
  }, { merge: true });
}

// Removes ONE game's score and nothing else.
//
// This previously did a read-modify-write with { merge: false }, which
// replaces the whole document — silently destroying the `specials` field
// (every division / conference / Super Bowl winner the admin had entered)
// every time anyone cleared a single game. deleteField() targets just the
// one nested key, so everything else in the doc is untouched. Fixture ids
// ("w1_1") contain no dots, so the dotted field path is unambiguous.
export async function fsClearResult(fixtureId) {
  await updateDoc(doc(db, "results", RESULTS_DOC_ID), {
    [`scores.${fixtureId}`]: deleteField(),
  });
}

export async function fsSetSpecialResult(key, teamCode) {
  // Special results (division/conference/superbowl winners) live in the same
  // doc under a separate field so they don't collide with fixture ids.
  await setDoc(doc(db, "results", RESULTS_DOC_ID), {
    specials: { [key]: teamCode },
  }, { merge: true });
}

// Playoff matchups — who's actually playing in each placeholder fixture, plus
// its kickoff. Set by a league admin once seeding is known; the placeholder
// fixtures themselves live in data/fixtures.js and never change.
export async function fsSetPlayoffFixture(fixtureId, matchup) {
  await setDoc(doc(db, "results", RESULTS_DOC_ID), {
    playoffFixtures: { [fixtureId]: matchup },
  }, { merge: true });
}

export async function fsClearPlayoffFixture(fixtureId) {
  await updateDoc(doc(db, "results", RESULTS_DOC_ID), {
    [`playoffFixtures.${fixtureId}`]: deleteField(),
  });
}

export function fsSubscribePlayoffFixtures(callback) {
  return onSnapshot(doc(db, "results", RESULTS_DOC_ID), (snap) =>
    callback(snap.exists() ? snap.data().playoffFixtures || {} : {})
  );
}

// ─── PRESEASON TRIAL ────────────────────────────────────────────────────────
//
// The fixtures themselves are CONSTANTS in data/fixtures.js — real teams, real
// kickoffs — so there's nothing to store about them. All that lives here is
// whether a rehearsal is currently running.
//
// It's an explicit switch rather than something inferred, because turning it on
// closes the regular season for everybody and turning it off is what puts the
// table back to zero. Both are decisions.

export async function fsSetTrialActive(on) {
  await setDoc(doc(db, "results", RESULTS_DOC_ID), { trialActive: !!on }, { merge: true });
}

export function fsSubscribeTrialActive(callback) {
  return onSnapshot(doc(db, "results", RESULTS_DOC_ID), (snap) =>
    callback(snap.exists() ? snap.data().trialActive === true : false)
  );
}

// Removes every trace of a trial week: the scores and everybody's picks for
// those games. The fixtures themselves are constants and stay put — unplayable
// once their kickoff has passed, and scoring nothing without picks.
//
// Picks are stored PER PERSON and shared across leagues, so this has to walk
// every predictions document — not just the members of one league. Missing a
// single one would leave a stray pick that scores nothing (the slot is gone)
// but still shows up in a backup and in that person's pick count.
//
// Returns what it did so the caller can report it honestly rather than
// claiming success it didn't verify.
export async function fsClearPreseasonTrial(fixtureIds) {
  // The only irreversible operation in the trial, and the one place a wrong id
  // would delete real season scores. Callers pass ids from the constant
  // preseason schedule, so this filter should never drop anything — which is
  // exactly why it's cheap to keep. A mis-wired button in some future version
  // gets refused here instead of quietly wiping Week 1.
  const all = (fixtureIds || []).filter(Boolean);
  const ids = all.filter(isPreseasonFixture);
  const refused = all.filter(id => !isPreseasonFixture(id));
  if (refused.length) console.error("Refused to clear non-preseason fixtures", refused);
  if (ids.length === 0) return { scoresCleared: 0, picksCleared: 0, failed: [], refused };

  const failed = [];
  let scoresCleared = 0, picksCleared = 0;

  // 1. The scores — one write, so it can't half-apply.
  try {
    const payload = {};
    for (const id of ids) payload[`scores.${id}`] = deleteField();
    await updateDoc(doc(db, "results", RESULTS_DOC_ID), payload);
    scoresCleared = ids.length;
  } catch (err) {
    if (err?.code !== "not-found") { console.error("Couldn't clear trial results", err); failed.push("results"); }
  }

  // 2. Everyone's picks. One write per person who actually has one, so a
  //    league of five is five writes, not one per game.
  const snap = await getDocs(collection(db, "predictions"));
  for (const d of snap.docs) {
    const picks = d.data()?.picks || {};
    const mine = ids.filter(id => picks[id] !== undefined);
    if (mine.length === 0) continue;
    try {
      const payload = {};
      for (const id of mine) payload[`picks.${id}`] = deleteField();
      await updateDoc(doc(db, "predictions", d.id), payload);
      picksCleared += mine.length;
    } catch (err) {
      console.error("Couldn't clear trial picks for", d.id, err);
      failed.push(`predictions/${d.id}`);
    }
  }

  return { scoresCleared, picksCleared, failed, refused };
}

export async function fsGetSpecialResults() {
  const snap = await getDoc(doc(db, "results", RESULTS_DOC_ID));
  return snap.exists() ? snap.data().specials || {} : {};
}

export function fsSubscribeSpecialResults(callback) {
  return onSnapshot(doc(db, "results", RESULTS_DOC_ID), (snap) =>
    callback(snap.exists() ? snap.data().specials || {} : {})
  );
}

// ══════════════════════════════════════════════════════════════════════════
// AUDIT LOG — one doc per change, append-only.
//
// A collection rather than an array on the league doc: an array would be a
// read-modify-write (two admins working the same evening would overwrite each
// other) and would eventually push the league document past Firestore's 1MB
// limit. Separate documents are atomic, cheap, and orderable server-side.
//
// The rules allow create and nothing else — no update, no delete — so the app
// itself can never rewrite history. See the note at the top of lib/auditLog.js
// about what that does and does not protect against.
// ══════════════════════════════════════════════════════════════════════════

const AUDIT_COLLECTION = "auditLog";

// Best-effort by design, and it is CRITICAL that it stays that way.
//
// The change is written first; this runs after. If logging were awaited as
// part of the same operation, a hiccup writing the log would surface as
// "couldn't save the score" for a score that had, in fact, already saved —
// and the admin would type it again. A missing log line is a much smaller
// problem than a phantom failure, so this swallows its own errors.
export async function fsLogChange(entry) {
  try {
    await addDoc(collection(db, AUDIT_COLLECTION), entry);
    return true;
  } catch (err) {
    console.error("Couldn't write the history entry (the change itself was saved)", err);
    return false;
  }
}

// Newest first, capped. `max` exists so opening the tab can't turn into a
// thousand-document read late in the season.
export function fsSubscribeAuditLog(callback, max = 400) {
  const q = query(collection(db, AUDIT_COLLECTION), orderBy("at", "desc"), limit(max));
  return onSnapshot(
    q,
    (snap) => {
      const entries = [];
      snap.forEach(d => entries.push({ id: d.id, ...d.data() }));
      callback(entries, null);
    },
    (err) => {
      console.error("Couldn't read the change history", err);
      callback([], err);
    }
  );
}

// ══════════════════════════════════════════════════════════════════════════
// FRESH START — clear a season's play, keep the people.
//
// The blunt version of this is deleting collections in the Firebase console,
// which also destroys every account and league: everyone re-registers,
// re-joins, re-picks their avatar and re-enters their timezone, and the league
// gets a new code you have to redistribute. That's a lot of friction for
// "let's start again".
//
// This removes only what was PLAYED:
//   predictions   every game pick and season pick, for everybody — deleted
//   results       scores, season winners, playoff matchups, trial slots — deleted
//   leagues       the standings snapshots and announcement-board reactions,
//                 which are derived leftovers that would otherwise show
//                 movement arrows against a table that no longer exists
//
// And keeps: accounts, usernames, avatars, timezones, the league itself, its
// code, its members, its admins and its scoring settings.
//
// NOT the audit log. That's the record of what happened — including this —
// and the rules forbid deleting from it anyway.
//
// Predictions and results are global, not per-league, so this is inherently
// app-wide. The caller says so plainly.
// ══════════════════════════════════════════════════════════════════════════

export async function fsWipeSeasonPlay({ leagueIds = [] } = {}) {
  const report = { predictionsDeleted: 0, resultsDeleted: false, leaguesCleaned: 0, failed: [] };

  // Every picks document, for every person.
  const snap = await getDocs(collection(db, "predictions"));
  for (const d of snap.docs) {
    try { await deleteDoc(doc(db, "predictions", d.id)); report.predictionsDeleted++; }
    catch (err) {
      console.error("Couldn't delete predictions for", d.id, err);
      report.failed.push(`predictions/${d.id}`);
    }
  }

  // The whole results document: scores, specials, playoff matchups and any
  // preseason trial slots all live in it.
  try {
    await deleteDoc(doc(db, "results", RESULTS_DOC_ID));
    report.resultsDeleted = true;
  } catch (err) {
    console.error("Couldn't delete the results document", err);
    report.failed.push("results");
  }

  // Derived leftovers on the league. Only leagues the caller actually
  // administers — the security rules would reject the rest, and silently
  // failing on somebody else's league would be worse than not trying.
  for (const id of leagueIds) {
    try {
      await updateDoc(doc(db, "leagues", id), {
        standingsSnapshot: deleteField(),
        standingsSnapshotVersion: deleteField(),
        standingsTrackedSnapshot: deleteField(),
        standingsTrackedVersion: deleteField(),
        reactions: deleteField(),
      });
      report.leaguesCleaned++;
    } catch (err) {
      console.error("Couldn't clean league", id, err);
      report.failed.push(`leagues/${id}`);
    }
  }

  return report;
}

// ══════════════════════════════════════════════════════════════════════════
// FETCHER HEALTH — one document, rewritten by every run of the results job.
// Read-only from the app; only the server-side function (which uses the admin
// SDK and bypasses rules) ever writes it.
// ══════════════════════════════════════════════════════════════════════════

export function fsSubscribeFetchHealth(callback) {
  return onSnapshot(
    doc(db, "health", "fetcher"),
    (snap) => callback(snap.exists() ? snap.data() : null),
    (err) => {
      // A missing rule shouldn't blank the admin panel — the health card just
      // reports that it can't read anything.
      console.error("Couldn't read fetcher health", err);
      callback(null);
    }
  );
}

export async function fsGetAuditLog(max = 2000) {
  const q = query(collection(db, AUDIT_COLLECTION), orderBy("at", "desc"), limit(max));
  const snap = await getDocs(q);
  const entries = [];
  snap.forEach(d => entries.push({ id: d.id, ...d.data() }));
  return entries;
}

// ══════════════════════════════════════════════════════════════════════════
// AUTH
// ══════════════════════════════════════════════════════════════════════════

export async function fbRegister(email, password) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function fbLogin(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function fbLogout() {
  await signOut(auth);
}

export async function fbResetPassword(email) {
  await sendPasswordResetEmail(auth, email);
}

// Sent right after registration, and available as a "Resend" action from the
// verification-reminder banner until the account is confirmed. Uses
// Firebase Auth's own built-in email — no third-party email service needed
// for this part (that's only required for custom notification emails, e.g.
// "you were added to a league", which is a separate, not-yet-built feature).
export async function fbSendVerificationEmail() {
  if (!auth.currentUser) throw new Error("No user logged in");
  await sendEmailVerification(auth.currentUser);
}

// Password/email changes both need a fresh reauth — Firebase rejects these
// "sensitive" operations on an older session even while still logged in.
export async function fbChangePassword(currentPassword, newPassword) {
  const user = auth.currentUser;
  if (!user) throw new Error("No user logged in");
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await updatePassword(user, newPassword);
}

// Note: some Firebase projects enforce a stricter policy on updateEmail
// (requiring the newer verifyBeforeUpdateEmail email-link flow instead,
// which needs authorized-domain/continue-URL setup). If this throws
// auth/operation-not-allowed in your project, that's why — flag it and we'll
// switch to that flow.
export async function fbChangeEmail(currentPassword, newEmail) {
  const user = auth.currentUser;
  if (!user) throw new Error("No user logged in");
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await updateEmail(user, newEmail);
  await fsWriteUser(user.uid, { email: newEmail });
  try { await sendEmailVerification(user); } catch { /* non-fatal, same as registration */ }
}

// Full account deletion, with cleanup — not just the Auth record. Without
// this, a deleted account leaves an orphaned uid sitting in every league's
// members/adminIds list forever, and a dangling predictions/users doc.
//
// One case is deliberately blocked rather than guessed at: if you're the
// super admin of a league that still has OTHER members, we refuse — there's
// no ownership-transfer feature, so silently deleting that league out from
// under other people, or leaving it permanently un-manageable (no one left
// who can hit Danger Zone), are both worse than making you sort it out
// first. Leagues where you're the sole member are just deleted outright;
// leagues where you're a plain member just drop your membership.
export async function fbDeleteAccountCascade(currentPassword) {
  const user = auth.currentUser;
  if (!user) throw new Error("No user logged in");
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);

  const uid = user.uid;
  const q = query(collection(db, "leagues"), where("members", "array-contains", uid));
  const snap = await getDocs(q);
  const myLeagues = [];
  snap.forEach(d => myLeagues.push(d.data()));

  const blocking = myLeagues.filter(l => l.superAdminId === uid && (l.members || []).length > 1);
  if (blocking.length > 0) {
    const names = blocking.map(l => l.name).join(", ");
    throw new Error(
      `You own ${blocking.length > 1 ? "leagues that still have" : "a league that still has"} other members (${names}). ` +
      `Delete ${blocking.length > 1 ? "them" : "it"} from that league's Danger Zone first, or remove the other members, before deleting your account.`
    );
  }

  for (const league of myLeagues) {
    if (league.superAdminId === uid) {
      await deleteDoc(doc(db, "leagues", league.id)); // sole member — safe to remove entirely
    } else {
      await updateDoc(doc(db, "leagues", league.id), { members: arrayRemove(uid), adminIds: arrayRemove(uid) });
    }
  }

  // Free the display name so someone else can use it.
  const profile = await fsReadUser(uid).catch(() => null);
  if (profile?.username) await fsReleaseUsername(profile.username);

  await deleteDoc(doc(db, "predictions", uid)).catch(() => {});
  await deleteDoc(doc(db, "users", uid)).catch(() => {});
  await deleteUser(user); // must be last — invalidates the session everything above relied on
}

export function fbOnAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}
