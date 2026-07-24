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
  fsSubscribeResults, fsSubscribeSpecialResults,
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
      setAuthChecked(true);
      if (!fbUser) { setUser(null); setSelectedLeagueId(null); setTab("dashboard"); return; }
      const [profile, prevLogin] = await Promise.all([
        fsReadUser(fbUser.uid),
        fsRecordLoginAndGetPrevious(fbUser.uid), // account-wide, not per-device
      ]);
      setLastLoginPrev(prevLogin);
      setUser({
        uid: fbUser.uid, username: profile?.username || fbUser.email, email: fbUser.email,
        avatar: profile?.avatar, timezone: profile?.timezone || "Europe/Athens",
        emailVerified: fbUser.emailVerified,
      });
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
    const u2 = fsSubscribeMyLeagues(user.uid, setMyLeagues);
    const u3 = fsSubscribeAllPredictions(setAllPredictions);
    const u4 = fsSubscribeResults(setResults);
    const u5 = fsSubscribeSpecialResults(setSpecialResults);
    return () => { u1(); u2(); u3(); u4(); u5(); };
  }, [user?.uid]);

  useEffect(() => {
    if (!user || selectedLeagueId || myLeagues.length !== 1) return;
    setSelectedLeagueId(myLeagues[0].id);
  }, [user, myLeagues]);

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

  const selectedLeague = myLeagues.find(l => l.id === selectedLeagueId) || null;

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

        {/* keyed on tab so React remounts it and the fade-in replays on switch */}
        <main className="main tab-view" key={tab}>
          {!user.emailVerified && <VerifyEmailBanner email={user.email} />}
          {tab === "dashboard" && (
            <DashboardTab
              user={user} league={selectedLeague} allUsers={allUsers} allPredictions={allPredictions}
              results={results} specialResults={specialResults} lastLoginPrev={lastLoginPrev} setTab={setTab}
            />
          )}
          {tab === "leagues" && (
            <LeaguesTab
              user={user} myLeagues={myLeagues} allUsers={allUsers}
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
