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
import {
  fbOnAuthChange, fbLogout, fsReadUser, fsRecordLoginAndGetPrevious,
  fsSubscribeAllUsers, fsSubscribeMyLeagues, fsSubscribeAllPredictions,
  fsSubscribeResults, fsSubscribeSpecialResults, fsClaimUsername, fsSubscribeUser,
} from "./firebase.js";

const APP_NAME = "SCORECLASH";
const INTRO_MS = 2600;

export default function App() {
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  // The full logo animation is a nice first impression, but a 2.6s wait on
  // every single open gets old fast — especially on a phone. Play it in full
  // once per browser session, then skip straight in on subsequent loads.
  const [showIntro, setShowIntro] = useState(() => {
    try { return sessionStorage.getItem("sc_introSeen") !== "true"; }
    catch { return true; } // private mode / storage blocked — just play it
  });
  const [tab, setTab] = useState("dashboard");
  const [selectedLeagueId, setSelectedLeagueId] = useState(null);
  const [darkMode, setDarkMode] = useState(true);
  const [lastLoginPrev, setLastLoginPrev] = useState(null);
  const [showHowItWorks, setShowHowItWorks] = useState(false);

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

  useEffect(() => {
    if (!showIntro) return;
    const id = setTimeout(() => {
      setShowIntro(false);
      try { sessionStorage.setItem("sc_introSeen", "true"); } catch { /* nothing to do */ }
    }, INTRO_MS);
    return () => clearTimeout(id);
  }, [showIntro]);

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
        setUser(null); setSelectedLeagueId(null); setTab("dashboard");
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
    return () => { u1(); u2(); u3(); u4(); u5(); };
  }, [user?.uid]);

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

  const handleLogin = (u) => setUser(u);
  const handleLogout = async () => { await fbLogout(); };
  const handleProfileUpdate = (updated) => setUser(updated);

  const stillBooting = !authChecked;

  if (showIntro || stillBooting) {
    return (
      <>
        <style>{css(darkMode)}</style>
        <LogoIntro name={APP_NAME} />
      </>
    );
  }

  if (!user) {
    return (
      <>
        <style>{css(darkMode)}</style>
        <AuthPage onLogin={handleLogin} />
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
      <style>{css(darkMode)}</style>
      <div className="app">
        <div className="topbar">
        <header className="header">
          <div className="brand" onClick={() => setTab("dashboard")}>
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
