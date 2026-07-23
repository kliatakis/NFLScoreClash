import { initializeApp } from "firebase/app";
import {
  getFirestore,
  doc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot,
  collection, getDocs, query, where, arrayUnion, arrayRemove,
} from "firebase/firestore";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  EmailAuthProvider,
  reauthenticateWithCredential,
  deleteUser,
} from "firebase/auth";
import { SEASON } from "./data/fixtures.js";

// ─── Firebase project config ────────────────────────────────────────────────
// This is a brand new, independent Firebase project — NOT the original
// ScoreClash project. Create a fresh project at console.firebase.google.com,
// enable Firestore + Email/Password Auth, then paste your config here.
const firebaseConfig = {
  apiKey: "REPLACE_ME",
  authDomain: "REPLACE_ME.firebaseapp.com",
  projectId: "REPLACE_ME",
  storageBucket: "REPLACE_ME.firebasestorage.app",
  messagingSenderId: "REPLACE_ME",
  appId: "REPLACE_ME",
};

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
// LEAGUES — one doc per league (collection, not a single mega-doc). Queried
// with array-contains so "my leagues" scales independently of total league
// count in the app.
// ══════════════════════════════════════════════════════════════════════════

export async function fsCreateLeague(league) {
  await setDoc(doc(db, "leagues", league.id), league);
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

export async function fsSetLeagueAdmins(leagueId, adminIds) {
  await updateDoc(doc(db, "leagues", leagueId), { adminIds });
}

// Persisted "standings as of the last time results changed" snapshot, used
// for the rise/fall arrows. Shared — every viewer sees the same arrows.
export async function fsSaveLeagueStandingsSnapshot(leagueId, snapshot, resultsVersion) {
  await updateDoc(doc(db, "leagues", leagueId), {
    standingsSnapshot: snapshot,
    standingsSnapshotVersion: resultsVersion,
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

export async function fsSaveGamePrediction(uid, fixtureId, homeScore, awayScore) {
  await setDoc(doc(db, "predictions", uid), {
    picks: { [fixtureId]: { homeScore: Number(homeScore), awayScore: Number(awayScore) } },
  }, { merge: true });
}

export async function fsSaveSpecialPick(uid, pickId, teamCode) {
  await setDoc(doc(db, "predictions", uid), {
    specials: { [pickId]: teamCode },
  }, { merge: true });
}

// Admin override — same write path, but tags who changed it and when so the
// UI can show the "corrected by an admin" asterisk.
export async function fsAdminOverrideGamePrediction(targetUid, fixtureId, homeScore, awayScore, adminUid) {
  await setDoc(doc(db, "predictions", targetUid), {
    picks: {
      [fixtureId]: {
        homeScore: Number(homeScore),
        awayScore: Number(awayScore),
        overriddenBy: adminUid,
        overriddenAt: Date.now(),
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

export async function fsClearResult(fixtureId) {
  const ref = doc(db, "results", RESULTS_DOC_ID);
  const snap = await getDoc(ref);
  const scores = snap.exists() ? snap.data().scores || {} : {};
  delete scores[fixtureId];
  await setDoc(ref, { scores }, { merge: false });
}

export async function fsSetSpecialResult(key, teamCode) {
  // Special results (division/conference/superbowl winners) live in the same
  // doc under a separate field so they don't collide with fixture ids.
  await setDoc(doc(db, "results", RESULTS_DOC_ID), {
    specials: { [key]: teamCode },
  }, { merge: true });
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

// Playoff matchups can't be known at build time (unlike the static regular
// season schedule) — they depend on real seeding. Any league admin can enter
// them once known; they're shared season-wide, same as regular results.
export async function fsSetPlayoffFixture(fixtureId, fixture) {
  await setDoc(doc(db, "results", RESULTS_DOC_ID), {
    playoffFixtures: { [fixtureId]: fixture },
  }, { merge: true });
}

export function fsSubscribePlayoffFixtures(callback) {
  return onSnapshot(doc(db, "results", RESULTS_DOC_ID), (snap) =>
    callback(snap.exists() ? snap.data().playoffFixtures || {} : {})
  );
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

export async function fbDeleteAccount(currentPassword) {
  const user = auth.currentUser;
  if (!user) throw new Error("No user logged in");
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await deleteUser(user);
}

export function fbOnAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}
