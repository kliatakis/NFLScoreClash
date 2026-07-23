import { useState, useEffect } from "react";
import { css } from "./theme.js";
import { HexIcon } from "./components/Logo.jsx";
import { LogoIntro } from "./components/Logo.jsx";
import AuthPage from "./components/AuthPage.jsx";
import ProfileDropdown from "./components/ProfileDropdown.jsx";
import DashboardTab from "./components/DashboardTab.jsx";
import LeaguesTab from "./components/LeaguesTab.jsx";
import PredictionsTab from "./components/PredictionsTab.jsx";
import NflStandingsTab from "./components/NflStandingsTab.jsx";
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
  const [showIntro, setShowIntro] = useState(true);
  const [tab, setTab] = useState("dashboard");
  const [selectedLeagueId, setSelectedLeagueId] = useState(null);
  const [darkMode, setDarkMode] = useState(true);
  const [lastLoginPrev, setLastLoginPrev] = useState(null);

  const [allUsers, setAllUsers] = useState({});
  const [myLeagues, setMyLeagues] = useState([]);
  const [allPredictions, setAllPredictions] = useState({});
  const [results, setResults] = useState({});
  const [specialResults, setSpecialResults] = useState({});

  // Intro plays once per app load, then dismisses (or holds if auth is
  // still resolving — see the loading gate below).
  useEffect(() => {
    const id = setTimeout(() => setShowIntro(false), INTRO_MS);
    return () => clearTimeout(id);
  }, []);

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

  const stillBooting = !authChecked || (user && myLeagues === null);

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
          <ProfileDropdown user={user} onLogout={handleLogout} onUpdate={handleProfileUpdate} darkMode={darkMode} onToggleDark={toggleDark} />
        </header>

        <nav className="nav">
          {navItems.map(t => (
            <button key={t.key} className={`nav-tab ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key)}>{t.label}</button>
          ))}
        </nav>

        <main className="main">
          {tab === "dashboard" && (
            <DashboardTab
              user={user} league={selectedLeague} allUsers={allUsers} allPredictions={allPredictions}
              results={results} specialResults={specialResults} lastLoginPrev={lastLoginPrev} setTab={setTab}
            />
          )}
          {tab === "leagues" && (
            <LeaguesTab
              user={user} myLeagues={myLeagues} allUsers={allUsers}
              selectedLeague={selectedLeagueId} onSetLeague={setSelectedLeagueId}
              refresh={() => {}}
            />
          )}
          {tab === "predictions" && <PredictionsTab user={user} />}
          {tab === "nflstandings" && <NflStandingsTab />}
        </main>
      </div>
    </>
  );
}
