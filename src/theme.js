// ─── THEME ──────────────────────────────────────────────────────────────────
// Dark by default. Same neon blue/red glow language as the original app, but
// pushed toward Sleeper (bold stat numbers, colorful team-coded cards) and
// Framer (glassmorphic translucent surfaces, soft ambient glows, motion).
export const css = (dark = true) => `
  @import url('https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;600;700;800;900&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:        ${dark ? "#07070b" : "#f3f4f8"};
    --bg-grad:   ${dark ? "radial-gradient(ellipse 60% 40% at 20% 0%, rgba(59,130,246,0.10) 0%, transparent 60%), radial-gradient(ellipse 60% 40% at 90% 20%, rgba(244,63,94,0.08) 0%, transparent 55%)" : "none"};
    --surface:   ${dark ? "rgba(22,22,32,0.6)" : "rgba(255,255,255,0.85)"};
    --surface2:  ${dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)"};
    --surface3:  ${dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"};
    --border:    ${dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"};
    --border2:   ${dark ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.15)"};
    --accent:    #3b82f6;
    --accent-glow: rgba(59,130,246,0.35);
    --accent2:   #f43f5e;
    --gold:      #f59e0b;
    --text:      ${dark ? "#f2f3fa" : "#0f1120"};
    --muted:     ${dark ? "#8890ab" : "#6b7290"};
    --green:     #22c55e;
    --font-display: 'Anton', 'Arial Black', Impact, sans-serif;
    --font-body: 'Inter', sans-serif;
    --r: 12px;
    --r2: 18px;
    --blur: 18px;
  }

  body { background: var(--bg); background-image: var(--bg-grad); background-attachment: fixed; color: var(--text); font-family: var(--font-body); min-height: 100vh; }

  ::-webkit-scrollbar { width: 5px; height: 5px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--surface3); border-radius: 3px; }

  .app { min-height: 100vh; display: flex; flex-direction: column; }

  .glass {
    background: var(--surface);
    backdrop-filter: blur(var(--blur));
    -webkit-backdrop-filter: blur(var(--blur));
    border: 1px solid var(--border);
  }

  /* HEADER */
  .header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 28px; position: sticky; top: 0; z-index: 100;
    border-bottom: 1px solid var(--border);
    background: var(--surface); backdrop-filter: blur(var(--blur));
  }
  .brand { display: flex; align-items: center; gap: 10px; cursor: pointer; }
  .brand-word { font-family: var(--font-display); font-size: 22px; letter-spacing: 1px; color: var(--accent); }
  .brand-word span { color: var(--accent2); }

  /* NAV */
  .nav { display: flex; align-items: center; padding: 8px 24px; gap: 6px; overflow-x: auto; scrollbar-width: none; border-bottom: 1px solid var(--border); }
  .nav::-webkit-scrollbar { display: none; }
  .nav-tab {
    background: transparent; border: 1px solid transparent; color: var(--muted);
    font-family: var(--font-body); font-size: 13px; font-weight: 600; padding: 8px 18px;
    border-radius: 20px; cursor: pointer; white-space: nowrap; flex-shrink: 0;
    transition: all 0.18s;
  }
  .nav-tab:hover { background: var(--surface2); color: var(--text); }
  .nav-tab.active {
    background: linear-gradient(135deg, rgba(59,130,246,0.22), rgba(244,63,94,0.12));
    color: var(--text); border-color: rgba(59,130,246,0.4);
    box-shadow: 0 0 16px rgba(59,130,246,0.2);
  }

  .main { flex: 1; padding: 24px 28px; max-width: 1080px; margin: 0 auto; width: 100%; }

  /* BUTTONS */
  .btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 11px 22px; border-radius: 10px; font-family: var(--font-body); font-size: 13px; font-weight: 700; cursor: pointer; transition: all 0.18s; border: none; }
  .btn-primary { background: linear-gradient(135deg, var(--accent), #06d6f7); color: #fff; }
  .btn-primary:hover { filter: brightness(1.1); transform: translateY(-1px); box-shadow: 0 8px 24px var(--accent-glow); }
  .btn-danger { background: var(--accent2); color: #fff; }
  .btn-ghost { background: transparent; border: 1px solid var(--border); color: var(--text); }
  .btn-ghost:hover { border-color: var(--accent); color: var(--accent); }
  .btn-full { width: 100%; }
  .btn-sm { padding: 7px 14px; font-size: 11px; }
  .btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none !important; }

  .error-msg { background: rgba(244,63,94,0.12); border: 1px solid rgba(244,63,94,0.3); color: var(--accent2); padding: 10px 14px; border-radius: 10px; font-size: 13px; margin-bottom: 16px; }
  .success-msg { background: rgba(34,197,94,0.12); border: 1px solid rgba(34,197,94,0.3); color: var(--green); padding: 10px 14px; border-radius: 10px; font-size: 13px; margin-bottom: 16px; }

  /* FORMS */
  .form-group { margin-bottom: 16px; }
  .form-label { display: block; font-size: 11px; color: var(--muted); margin-bottom: 6px; font-weight: 600; letter-spacing: 0.6px; text-transform: uppercase; }
  .form-input, .form-select {
    width: 100%; background: var(--surface2); border: 1px solid var(--border); color: var(--text);
    font-family: var(--font-body); font-size: 15px; padding: 12px 14px; border-radius: 10px; outline: none;
    transition: border-color 0.18s;
  }
  .form-input:focus, .form-select:focus { border-color: var(--accent); }
  .form-select option { background: #14141d; }

  .page-title { font-family: var(--font-display); font-size: 32px; letter-spacing: 1px; margin-bottom: 4px; }
  .page-sub { font-size: 13px; color: var(--muted); margin-bottom: 24px; }

  .card { border-radius: var(--r2); padding: 22px; }
  .card-title { font-family: var(--font-display); font-size: 15px; letter-spacing: 1px; color: var(--muted); margin-bottom: 16px; }

  .grid-2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-bottom: 24px; }
  .grid-3 { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 14px; }
  .grid-4 { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 14px; }

  /* STAT CARDS */
  .stat-card { border-radius: var(--r2); padding: 18px 20px; display: flex; flex-direction: column; gap: 4px; position: relative; overflow: hidden; transition: transform 0.2s; }
  .stat-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: var(--card-accent, linear-gradient(90deg, var(--accent), #06d6f7)); }
  .stat-card:hover { transform: translateY(-2px); }
  .stat-card-val { font-family: var(--font-display); font-size: 36px; letter-spacing: 1px; line-height: 1; }
  .stat-card-label { font-size: 11px; color: var(--muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; }

  /* TEAM BADGE — colored chip with emoji (or abbr fallback), never a logo image */
  .team-badge { display: inline-flex; align-items: center; gap: 8px; padding: 5px 10px 5px 6px; border-radius: 20px; font-weight: 700; font-size: 13px; }
  .team-badge-icon { width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; }
  .team-badge-abbr { font-size: 10px; letter-spacing: 0.5px; }

  /* FIXTURE / PREDICTION ROWS */
  .fixture-card { border-radius: var(--r2); margin-bottom: 10px; overflow: hidden; transition: border-color 0.2s, box-shadow 0.2s; }
  .fixture-card:hover { border-color: var(--border2); }
  .fixture-card.locked .fixture-body { opacity: 0.55; }
  .fixture-card.predicted { border-color: rgba(59,130,246,0.35); }
  .fixture-meta { padding: 10px 18px 0; font-size: 11px; color: var(--text); opacity: 0.7; letter-spacing: 0.2px; }
  .fixture-body { display: flex; align-items: center; gap: 14px; padding: 10px 18px 14px; flex-wrap: wrap; }
  .fixture-teams { flex: 1; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; min-width: 0; }
  .fixture-vs { font-size: 10px; color: var(--muted); letter-spacing: 1px; }
  .score-input { width: 46px; background: var(--surface2); border: 1px solid var(--border); color: var(--text); font-family: var(--font-body); font-size: 17px; font-weight: 800; padding: 6px; border-radius: 8px; text-align: center; outline: none; }
  .score-input:focus { border-color: var(--accent); }
  .score-input:disabled { opacity: 0.5; }
  .score-sep { color: var(--muted); font-size: 15px; }
  .lock-badge { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 20px; }
  .lock-badge.locked { color: var(--accent2); background: rgba(244,63,94,0.1); }
  .lock-badge.open { color: var(--green); background: rgba(34,197,94,0.1); }

  .overridden-flag { color: var(--gold); font-size: 12px; font-weight: 800; cursor: help; margin-left: 4px; }

  /* STANDINGS TABLE + MOVEMENT ARROWS */
  .standings-row { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 12px; margin-bottom: 6px; transition: background 0.15s; }
  .standings-row:hover { background: var(--surface2); }
  .standings-rank { font-family: var(--font-display); font-size: 18px; color: var(--muted); width: 28px; }
  .standings-rank.gold { color: var(--gold); }
  .standings-rank.silver { color: #b7bccb; }
  .standings-rank.bronze { color: #c98a52; }
  .standings-name { flex: 1; font-weight: 700; font-size: 14px; }
  .standings-name.you { color: var(--accent2); }
  .standings-pts { font-family: var(--font-display); font-size: 20px; color: var(--accent); min-width: 50px; text-align: right; }
  .movement { display: inline-flex; gap: 1px; width: 18px; justify-content: center; }
  .movement-dash { color: var(--muted); font-weight: 700; }
  .movement-arrow.up { color: var(--green); }
  .movement-arrow.down { color: var(--accent2); }

  /* MODALS */
  .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 500; padding: 20px; }
  .modal { background: #14141d; border: 1px solid var(--border2); border-radius: var(--r2); padding: 28px; width: 100%; max-width: 420px; box-shadow: 0 24px 70px rgba(0,0,0,0.6); }
  .modal-title { font-family: var(--font-display); font-size: 22px; letter-spacing: 1px; margin-bottom: 6px; }
  .modal-sub { font-size: 13px; color: var(--muted); margin-bottom: 20px; }
  .modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 6px; }

  /* AVATAR */
  .avatar { border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; font-weight: 800; user-select: none; background: var(--surface3); border: 1.5px solid var(--border2); }

  /* PROFILE DROPDOWN */
  .profile-btn { display: flex; align-items: center; gap: 8px; background: var(--surface2); border: 1px solid var(--border); color: var(--text); border-radius: 12px; padding: 5px 12px 5px 6px; cursor: pointer; font-size: 13px; font-weight: 600; }
  .profile-dropdown { position: absolute; top: calc(100% + 10px); right: 28px; width: 280px; border-radius: 16px; z-index: 300; overflow: hidden; animation: dropIn 0.16s ease; }
  @keyframes dropIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
  .profile-section { padding: 14px 16px; border-bottom: 1px solid var(--border); }

  .toggle-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; }
  .toggle { width: 40px; height: 22px; border-radius: 11px; background: var(--surface3); position: relative; cursor: pointer; transition: background 0.18s; }
  .toggle.on { background: var(--accent); }
  .toggle::after { content: ''; position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 50%; background: #fff; transition: transform 0.18s; }
  .toggle.on::after { transform: translateX(18px); }

  .chip { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 20px; font-size: 10px; font-weight: 700; background: var(--surface2); border: 1px solid var(--border); color: var(--muted); }
  .chip.active { background: rgba(59,130,246,0.15); color: var(--accent); border-color: rgba(59,130,246,0.35); }
  .chip.super { background: rgba(245,158,11,0.15); color: var(--gold); border-color: rgba(245,158,11,0.35); }

  /* Shared keyframes used by the animated logo intro (components/Logo.jsx) */
  @keyframes draw-ring { to { stroke-dashoffset: 0; } }
  @keyframes bolt-strike { 0% { opacity: 0; transform: scale(0.5) rotate(-8deg); } 60% { opacity: 1; transform: scale(1.15) rotate(3deg); } 100% { opacity: 1; transform: scale(1) rotate(0deg); } }
  @keyframes slide-in-left { to { opacity: 1; transform: translateX(0); } }
  @keyframes slide-in-right { to { opacity: 1; transform: translateX(0); } }
  @keyframes fade-up { to { opacity: 1; } }
  @keyframes pulse-bar { 0%, 100% { width: 20%; margin-left: 0%; } 50% { width: 60%; margin-left: 40%; } }
`;
