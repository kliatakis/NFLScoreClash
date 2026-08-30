import { useState, useEffect } from "react";
import { css } from "./theme.js";
import { HexIcon } from "./components/Logo.jsx";
import { LogoIntro } from "./components/Logo.jsx";
import AuthPage from "./components/AuthPage.jsx";
import Footer from "./components/Footer.jsx";
import ProfileDropdown from "./components/ProfileDropdown.jsx";
import DashboardTab from "./components/DashboardTab.jsx";
import VerifyEmailBanner from "./components/VerifyEmailBanner.jsx";
import LeaguesTab from "./components/LeaguesTab.jsx";
import PredictionsTab from "./components/PredictionsTab.jsx";
import NflStandingsTab from "./components/NflStandingsTab.jsx";
import HowItWorks from "./components/HowItWorks.jsx";
import { shouldRefresh, readLastRefresh, writeLastRefresh } from "./lib/liveRefresh.js";
import {
  fbOnAuthChange, fbLogout, fsReadUser, fsRecordLoginAndGetPrevious,
  fsSubscribeAllUsers, fsSubscribeMyLeagues, fsSubscribeAllPredictions,
  fsSubscribeResults, fsSubscribeSpecialResults, fsSubscribePlayoffFixtures,
  fsClaimUsername, fsSubscribeUser,
} from "./firebase.js";

const APP_NAME = "SCORECLASH";

// An invite link looks like https://scoreclash.vercel.app/?join=ABC123
//
// Read once on boot and immediately stripped from the address bar, so a
// refresh (or landing back here after sign-up) doesn't re-trigger the join
// dialog. Parked in sessionStorage because the code has to survive the whole
// registration flow — someone following an invite usually has no account yet,
// and losing the code at that point drops them on an empty dashboard, which is
// exactly the problem the link was meant to solve.
const JOIN_KEY = "sc_pendingJoin";
function readInviteCode() {
  let code = null;
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("join");
    if (raw) {
      // Codes are generated from [A-Z0-9] only, so anything else came from a
      // mangled link or someone editing the URL. Stripping it keeps junk out
      // of the Firestore lookup — a "/" in particular would build an invalid
      // document path and throw rather than simply not matching.
      code = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
      params.delete("join");
      const qs = params.toString();
      window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash);
    }
    if (code) sessionStorage.setItem(JOIN_KEY, code);
    else code = sessionStorage.getItem(JOIN_KEY);
  } catch { /* private mode, or no history API — just skip the invite flow */ }
  return code || null;
}
function clearInviteCode() {
  try { sessionStorage.removeItem(JOIN_KEY); } catch { /* nothing to do */ }
}
// Full run of the intro animation, played once per browser session.
// The timeline finishes at 2.55s (tagline) and the loading bar only appears
// at 2.3s, so exiting at 2.6s cut away the moment the composition was finally
// whole — the bar was on screen for a third of a second and never completed a
// pulse. 3.2s lets the finished mark hold for a beat, which is the part that
// reads as deliberate rather than rushed.
const INTRO_MS = 3200;
// On a reload the animation is already familiar, so it's cut short — but not
// arbitrarily. The timeline is: ring draws to 1.1s, bolt strikes 1.05–1.55s,
// wordmark slides in 1.5–2.0s. Leaving before ~1.8s means exiting on a
// half-built logo, which is exactly the "something flashed" feeling this is
// meant to remove. 1.8s is the first moment the composition looks finished.
// Same reasoning on a reload, one stage earlier: the wordmark slides in over
// 1.5–2.0s, so 1.8s exited half way through it. 2.1s is the first moment the
// wordmark is actually settled.
const INTRO_REPLAY_MS = 2100;
// Hard ceiling. If Firestore never answers (offline, blocked, rules broken)
// the boot screen must still get out of the way and let the app render
// whatever it has, rather than spinning forever.
const BOOT_MAX_MS = 6000;
// How long the splash takes to fade away over the app underneath. Long enough
// to read as a transition, short enough not to be a second wait.
const SPLASH_FADE_MS = 420;

export default function App() {
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  // The full logo animation is a nice first impression, but a 2.6s wait on
  // every single open gets old fast — especially on a phone. Play it in full
  // once per browser session, then skip straight in on subsequent loads.
  const [firstRunThisSession] = useState(() => {
    try { return sessionStorage.getItem("sc_introSeen") !== "true"; }
    catch { return true; } // private mode / storage blocked — just play it
  });
  // Two independent gates, both of which must clear before the app shows:
  // the animation has had its minimum run, and the first payload of data has
  // actually arrived.
  const [introMinDone, setIntroMinDone] = useState(false);
  const [bootTimedOut, setBootTimedOut] = useState(false);
  // Unmounts the splash once its fade-out has finished. Kept as state rather
  // than a CSS-only trick so the element genuinely leaves the tree and can't
  // swallow taps on the page underneath.
  const [splashGone, setSplashGone] = useState(false);
  const [tab, setTab] = useState("dashboard");
  const [selectedLeagueId, setSelectedLeagueId] = useState(null);
  const [darkMode, setDarkMode] = useState(true);
  const [lastLoginPrev, setLastLoginPrev] = useState(null);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [inviteCode, setInviteCode] = useState(() => readInviteCode());

  const [allUsers, setAllUsers] = useState({});
  const [myLeagues, setMyLeagues] = useState([]);
  // Distinguishes "you have no leagues" from "we haven't heard back yet".
  // Without it the dashboard rendered its empty state during the gap between
  // sign-in and the leagues snapshot arriving — a "No league yet" flash on
  // every single reload, for people who are very much in a league.
  const [leaguesLoaded, setLeaguesLoaded] = useState(false);
  const [allPredictions, setAllPredictions] = useState({});
  const [results, setResults] = useState({});
  const [specialResults, setSpecialResults] = useState({});
  const [playoffMatchups, setPlayoffMatchups] = useState({});

  useEffect(() => {
    const hold = setTimeout(() => {
      setIntroMinDone(true);
      try { sessionStorage.setItem("sc_introSeen", "true"); } catch { /* nothing to do */ }
    }, firstRunThisSession ? INTRO_MS : INTRO_REPLAY_MS);
    const bail = setTimeout(() => setBootTimedOut(true), BOOT_MAX_MS);
    return () => { clearTimeout(hold); clearTimeout(bail); };
  }, []);

  // Retire the splash once its fade has run. Must outlast the CSS duration or
  // it vanishes mid-fade, which looks worse than no fade at all.
  const bootDone = bootTimedOut || (introMinDone && authChecked && (!user || leaguesLoaded));
  useEffect(() => {
    if (!bootDone || splashGone) return;
    const id = setTimeout(() => setSplashGone(true), SPLASH_FADE_MS + 60);
    return () => clearTimeout(id);
  }, [bootDone, splashGone]);

  useEffect(() => {
    const saved = localStorage.getItem("gc_darkMode"); // display preference only — not app data, fine on-device
    if (saved !== null) setDarkMode(saved === "true");
  }, []);
  const toggleDark = () => setDarkMode(d => {
    localStorage.setItem("gc_darkMode", String(!d));
    return !d;
  });

  useEffect(() => {
    const unsub = fbOnAuthChange(async (fbUser) => {
      // `authChecked` is what gates the sign-in page, and it deliberately does
      // NOT flip the moment Firebase hands us a user.
      //
      // It used to. Firebase would restore the session, this fired with a real
      // user, authChecked went true — and then we spent two round trips
      // fetching the profile with `user` still null. For that window the app
      // decided nobody was signed in and rendered the login page, which is the
      // flash you'd see on every reload. Now the boot screen stays up until
      // there's either a full user or a definite no.
      if (!fbUser) {
        // Reset everything the previous session left behind. `leaguesLoaded`
        // is the one that bites: left true, the next person to sign in on this
        // browser gets "No league yet" during the gap before their own leagues
        // arrive — the exact flash the flag exists to prevent. The invite code
        // matters too, or a pending invite would follow them into a different
        // account.
        setUser(null); setSelectedLeagueId(null); setTab("dashboard");
        setMyLeagues([]); setLeaguesLoaded(false);
        setAllPredictions({}); setLastLoginPrev(null);
        setInviteCode(null); clearInviteCode();
        setAuthChecked(true);
        return;
      }
      try {
        const [profile, prevLogin] = await Promise.all([
          fsReadUser(fbUser.uid),
          fsRecordLoginAndGetPrevious(fbUser.uid), // account-wide, not per-device
        ]);
        setLastLoginPrev(prevLogin);
        // Back-fill the username claim for accounts created before the
        // `usernames` collection existed, so their names can't be taken by
        // someone new. No-ops once claimed; never blocks login.
        if (profile?.username) {
          fsClaimUsername(fbUser.uid, profile.username).catch(() => {});
        }
        setUser({
          uid: fbUser.uid, username: profile?.username || fbUser.email, email: fbUser.email,
          avatar: profile?.avatar, timezone: profile?.timezone || "Europe/Athens",
          emailVerified: fbUser.emailVerified,
        });
      } catch (err) {
        // A failed profile read must not strand a signed-in person on the boot
        // screen forever — let them in with what the auth token already tells
        // us, and the live profile subscription will fill in the rest.
        console.error("Couldn't load profile on sign-in", err);
        setUser({
          uid: fbUser.uid, username: fbUser.email, email: fbUser.email,
          avatar: null, timezone: "Europe/Athens", emailVerified: fbUser.emailVerified,
        });
      } finally {
        setAuthChecked(true);
      }
    });
    return () => unsub();
  }, []);

  // Global, real-time subscriptions — collections, not mega-docs (see
  // firebase.js). Reading all predictions docs is still one small doc per
  // person rather than one 1MB-capped blob; a further optimization if this
  // ever needs trimming is scoping the predictions read to only the
  // currently-selected league's members instead of every user in the app.
  useEffect(() => {
    if (!user) return;
    const u1 = fsSubscribeAllUsers(setAllUsers);
    const u2 = fsSubscribeMyLeagues(user.uid, (ls) => { setMyLeagues(ls); setLeaguesLoaded(true); });
    const u3 = fsSubscribeAllPredictions(setAllPredictions);
    const u4 = fsSubscribeResults(setResults);
    const u5 = fsSubscribeSpecialResults(setSpecialResults);
    // Needed by the game-day refresh below to know when a playoff game has
    // kicked off — the placeholder fixtures carry no time of their own.
    const u6 = fsSubscribePlayoffFixtures(setPlayoffMatchups);
    return () => { u1(); u2(); u3(); u4(); u5(); u6(); };
  }, [user?.uid]);

  // ── Game-day refresh ─────────────────────────────────────────────────────
  //
  // The cron can only run once a day on the free plan, at 06:00 UTC. Sunday's
  // late games finish at 03:30 UTC, so without this the standings stay frozen
  // through the whole Sunday evening and quietly update overnight — missing
  // the only hours anyone is actually watching.
  //
  // Whoever has the app open during a game is the trigger. It does nothing at
  // all outside a live window, and shares one throttle across every tab on the
  // device. See lib/liveRefresh.js.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const maybeRefresh = async () => {
      if (cancelled || document.hidden) return;
      if (!shouldRefresh({ results, lastRefreshAt: readLastRefresh(), playoffMatchups })) return;
      // Written BEFORE the request, not after: a slow or failing call must
      // still hold the throttle, or a broken endpoint would be retried on
      // every tick.
      writeLastRefresh();
      try {
        await fetch("/api/fetch-results?manual=true");
      } catch (err) {
        // Entirely best-effort. The daily cron and the admin's manual button
        // are both still there, and nothing on screen depends on this.
        console.warn("Game-day refresh didn't go through", err);
      }
    };

    maybeRefresh();
    const id = setInterval(maybeRefresh, 60000);
    // Coming back to a backgrounded tab is the most likely moment for this to
    // matter — you've been watching the game, not the app.
    const onVisible = () => { if (!document.hidden) maybeRefresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { cancelled = true; clearInterval(id); document.removeEventListener("visibilitychange", onVisible); };
  }, [user?.uid, results, playoffMatchups]);

  // Keep the signed-in user's own profile live.
  //
  // Registration is a race: creating the account fires the auth listener,
  // which reads users/{uid} — but AuthPage is still in the middle of WRITING
  // that document. The read can therefore come back empty and fall back to
  // showing the email address instead of the username the person just chose,
  // and it would stay wrong until the next full reload. Subscribing means
  // whatever lands in the document wins, whenever it lands. It also makes
  // profile edits from another device show up here without a refresh.
  useEffect(() => {
    if (!user?.uid) return;
    return fsSubscribeUser(user.uid, (profile) => {
      if (!profile) return;
      setUser(prev => (prev ? {
        ...prev,
        username: profile.username || prev.username,
        avatar: profile.avatar ?? prev.avatar,
        timezone: profile.timezone || prev.timezone,
      } : prev));
    });
  }, [user?.uid]);

  // Act on an invite link once we know who the person is and which leagues
  // they're already in — otherwise someone following a link to a league they
  // already belong to would be shown a pointless "join" dialog.
  useEffect(() => {
    if (!inviteCode || !user || !leaguesLoaded) return;
    const already = myLeagues.find(l => l.id === inviteCode);
    if (already) {
      setSelectedLeagueId(already.id);
      setInviteCode(null);
      clearInviteCode();
      return;
    }
    setTab("leagues");
  }, [inviteCode, user, leaguesLoaded, myLeagues]);

  const handleInviteHandled = () => { setInviteCode(null); clearInviteCode(); };

  // Drop a selection that no longer exists — you left the league, an admin
  // kicked you, or the whole league was deleted. Without this the id lingers,
  // `selectedLeague` resolves to null, and the dashboard claims you have no
  // league at all even when you're still in one. Runs before the auto-select
  // below so the two can't fight over the same render.
  useEffect(() => {
    if (!selectedLeagueId) return;
    if (!myLeagues.some(l => l.id === selectedLeagueId)) setSelectedLeagueId(null);
  }, [myLeagues, selectedLeagueId]);

  useEffect(() => {
    if (!user || selectedLeagueId || myLeagues.length !== 1) return;
    setSelectedLeagueId(myLeagues[0].id);
  }, [user, myLeagues, selectedLeagueId]);

  // Merged, not replaced. The auth listener and this callback both fire around
  // sign-in and either can land second; a plain replace meant whichever came
  // last could drop fields the other had already resolved (timezone in
  // particular, which silently reverted everyone to Athens).
  const handleLogin = (u) => setUser(prev => ({ ...prev, ...u }));
  const handleLogout = async () => { await fbLogout(); };
  const handleProfileUpdate = (updated) => setUser(updated);

  // The stylesheet is ~80,000 characters, and it was being rebuilt from the
  // template literal on EVERY render of this component — which is every
  // Firestore snapshot, every tab switch, every countdown tick. React then
  // compared the fresh string against the old one and, finding them equal,
  // did nothing with it. Pure waste, and it peaks on game day when results
  // are landing. It only actually changes when the theme does.
  const sheet = useMemo(() => css(darkMode), [darkMode]);

  // The intro used to end on a fixed timer regardless of whether anything was
  // ready. On a reload that meant: hexagon appears, animation is cut off
  // part-way, then a skeleton, then the real screen — three states in about a
  // second. Waiting for the data too means one clean hand-off from the intro
  // straight to the finished page.
  const dataReady = authChecked && (!user || leaguesLoaded);
  const stillBooting = !bootTimedOut && (!introMinDone || !dataReady);

  // The splash used to be swapped for the app in a single frame — a hard cut
  // from a full-screen dark logo to a populated page. Everything the intro
  // builds up is spent in that one jump. Keeping it mounted for one more beat
  // while it fades lets the page arrive underneath it instead.
  if (stillBooting) {
    return (
      <>
        <style>{sheet}</style>
        <div className="boot-splash"><LogoIntro name={APP_NAME} /></div>
      </>
    );
  }

  const splash = splashGone ? null : (
    <div className="boot-splash leaving" aria-hidden="true"><LogoIntro name={APP_NAME} /></div>
  );

  if (!user) {
    return (
      <>
        <style>{sheet}</style>
        <AuthPage onLogin={handleLogin} />
        {splash}
      </>
    );
  }

  // Falls back to your only league rather than waiting for the auto-select
  // effect to run. That effect fires AFTER the render in which the leagues
  // first arrive, so without this fallback there is one frame where you have
  // exactly one league and nothing selected — another flash of the empty
  // state.
  const selectedLeague =
    myLeagues.find(l => l.id === selectedLeagueId)
    || (myLeagues.length === 1 ? myLeagues[0] : null);

  const navItems = [
    { key: "dashboard", label: "Dashboard" },
    { key: "leagues", label: "My Leagues" },
    { key: "predictions", label: "Predictions" },
    { key: "nflstandings", label: "NFL Standings" },
  ];

  return (
    <>
      <style>{sheet}</style>
      <div className="app">
        <div className="topbar">
        <header className="header">
          <div className="brand" role="button" tabIndex={0} aria-label="Go to the dashboard"
            onClick={() => setTab("dashboard")}
            onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setTab("dashboard"); } }}>
            <HexIcon size={34} />
            <div className="brand-word">{APP_NAME.slice(0, Math.ceil(APP_NAME.length / 2))}<span>{APP_NAME.slice(Math.ceil(APP_NAME.length / 2))}</span></div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button className="help-btn" title="How ScoreClash works" onClick={() => setShowHowItWorks(true)}>?</button>
            <ProfileDropdown user={user} onLogout={handleLogout} onUpdate={handleProfileUpdate} darkMode={darkMode} onToggleDark={toggleDark} />
          </div>
        </header>

        <nav className="nav">
          {navItems.map(t => (
            <button key={t.key} className={`nav-tab ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key)}>{t.label}</button>
          ))}
        </nav>
        </div>

        {/* keyed on tab so React remounts it and the fade-in replays on switch */}
        <main className="main tab-view" key={tab}>
          {!user.emailVerified && <VerifyEmailBanner email={user.email} />}
          {tab === "dashboard" && (
            <DashboardTab
              user={user} league={selectedLeague} allUsers={allUsers} allPredictions={allPredictions}
              results={results} specialResults={specialResults} lastLoginPrev={lastLoginPrev} setTab={setTab}
              leaguesLoaded={leaguesLoaded} hasLeagues={myLeagues.length > 0}
            />
          )}
          {tab === "leagues" && (
            <LeaguesTab
              user={user} myLeagues={myLeagues} allUsers={allUsers} leaguesLoaded={leaguesLoaded}
              inviteCode={inviteCode} onInviteHandled={handleInviteHandled}
              allPredictions={allPredictions} results={results} specialResults={specialResults}
              selectedLeague={selectedLeagueId} onSetLeague={setSelectedLeagueId}

            />
          )}
          {tab === "predictions" && (
            <PredictionsTab user={user} league={selectedLeague} allUsers={allUsers} allPredictions={allPredictions} specialResults={specialResults} />
          )}
          {tab === "nflstandings" && <NflStandingsTab />}
        </main>

        <Footer />
      </div>

      {showHowItWorks && <HowItWorks onClose={() => setShowHowItWorks(false)} />}
    </>
  );
}
