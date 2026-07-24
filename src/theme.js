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
    --surface-solid: ${dark ? "rgba(13,13,20,0.98)" : "rgba(255,255,255,0.98)"};
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

  /* Footer — scrolls with the page, not fixed/sticky (no floating bars
     eating into phone screen space). */
  .app-footer { padding: 28px 24px 20px; text-align: center; margin-top: auto; }
  .app-footer-creator { font-size: 11px; font-weight: 800; letter-spacing: 0.6px; color: var(--muted); margin-bottom: 6px; }
  .app-footer-legal { font-size: 9.5px; line-height: 1.5; color: var(--muted); opacity: 0.55; max-width: 640px; margin: 0 auto; }

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
  .fixture-teams { flex: 1; display: flex; flex-direction: column; gap: 6px; min-width: 0; }
  .fixture-team-row { display: flex; align-items: center; }
  .fixture-vs { padding-left: 34px; font-size: 10px; color: var(--muted); letter-spacing: 1px; }
  .fixture-action { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
  .score-input { width: 46px; background: var(--surface2); border: 1px solid var(--border); color: var(--text); font-family: var(--font-body); font-size: 17px; font-weight: 800; padding: 6px; border-radius: 8px; text-align: center; outline: none; }
  .score-input:focus { border-color: var(--accent); }
  .score-input:disabled { opacity: 0.5; }
  .score-sep { color: var(--muted); font-size: 15px; }
  .lock-badge { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 20px; }
  .lock-badge.locked { color: var(--accent2); background: rgba(244,63,94,0.1); }
  .lock-badge.open { color: var(--green); background: rgba(34,197,94,0.1); }
  .lock-badge.warn { color: var(--gold); background: rgba(245,158,11,0.1); }
  .lock-badge.urgent { color: var(--accent2); background: rgba(244,63,94,0.1); }

  /* Reveal-everyone's-picks (Predictions tab, once a game/pick is decided) */
  .fixture-reveal { padding: 0 18px 12px; }
  .reveal-list { margin-top: 8px; display: flex; flex-direction: column; gap: 4px; }
  .reveal-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 12.5px; padding: 4px 0; border-bottom: 1px solid var(--border); }
  .reveal-row:last-child { border-bottom: none; }
  .reveal-exact { color: var(--gold); font-weight: 700; }
  .reveal-correct { color: var(--green); font-weight: 600; }
  .reveal-wrong { color: var(--muted); }
  .reveal-none { color: var(--muted); font-style: italic; }

  /* Dashboard highlights ("announcement board") */
  .highlight-row { font-size: 13px; line-height: 1.5; padding: 10px 14px; border-radius: 10px; background: var(--surface2); }

  /* Scoring settings summary, shown above the standings Notes section — a
     vertical list of rows, each ending in a colored pill rather than plain
     bold text (bold-on-dark-background didn't read as a "value" clearly). */
  .scoring-summary { display: flex; flex-direction: column; gap: 2px; }
  .scoring-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 4px 2px; font-size: 11px; color: var(--muted); }
  .scoring-pts { display: inline-flex; align-items: center; justify-content: center; min-width: 36px; padding: 2px 10px; border-radius: 20px; background: rgba(59,130,246,0.12); border: 1px solid rgba(59,130,246,0.3); color: var(--accent); font-weight: 700; font-size: 10px; }

  /* Notes — card-style rows with a numbered badge instead of a plain "1."
     list marker, and the 4-step tiebreaker order shown as a chip chain
     instead of a nested lettered list. */
  .note-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; counter-reset: note; }
  .note-list > li { counter-increment: note; position: relative; padding: 10px 14px 10px 38px; background: var(--surface2); border: 1px solid var(--border); border-radius: 12px; font-size: 12px; line-height: 1.55; }
  .note-list > li::before {
    content: counter(note); position: absolute; left: 12px; top: 11px;
    width: 18px; height: 18px; border-radius: 50%; background: var(--accent);
    color: #fff; font-size: 10px; font-weight: 800; display: flex; align-items: center; justify-content: center;
  }
  .tiebreak-steps { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
  .tiebreak-step { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px 4px 4px; border-radius: 20px; background: var(--surface3); font-size: 11px; color: var(--text); }
  .tiebreak-step-num { display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; border-radius: 50%; background: var(--gold); color: #1a1200; font-size: 9.5px; font-weight: 800; flex-shrink: 0; }

  .overridden-flag { color: var(--gold); font-size: 12px; font-weight: 800; cursor: help; margin-left: 4px; }

  /* STANDINGS TABLE + MOVEMENT ARROWS */
  .standings-row { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 12px; margin-bottom: 6px; transition: background 0.15s; }
  .standings-row:hover { background: var(--surface2); }
  .standings-rank { font-family: var(--font-display); font-size: 18px; color: var(--muted); text-align: center; }
  .standings-name { font-weight: 700; font-size: 14px; }
  .standings-name.you { color: var(--accent2); }
  .standings-pts { font-family: var(--font-display); font-size: 20px; color: var(--accent); }
  .movement { display: inline-flex; gap: 1px; justify-content: center; }
  .movement-dash { color: var(--muted); font-weight: 700; }
  .movement-arrow.up { color: var(--green); }
  .movement-arrow.down { color: var(--accent2); }

  /* Divider lines marking off the podium (top 3) and the bottom spot,
     rather than just relying on the medal/toilet emoji alone. */
  .standings-divider { height: 2px; margin: 2px 0 8px; border-radius: 2px; }
  .standings-divider-podium { background: linear-gradient(90deg, transparent, var(--gold), transparent); }
  .standings-divider-caution { background: linear-gradient(90deg, transparent, var(--accent2), transparent); margin: 8px 0 2px; }

  /* Standings table columns — shared widths so the header row lines up with
     the data rows exactly. */
  .standings-col-rank { width: 34px; flex-shrink: 0; text-align: center; }
  .standings-col-player { flex: 1; min-width: 0; }
  .standings-col-stat { width: 84px; flex-shrink: 0; text-align: center; }
  .standings-col-pts { width: 74px; flex-shrink: 0; text-align: right; }
  .standings-col-move { width: 30px; flex-shrink: 0; display: flex; justify-content: center; }
  .standings-head { padding-top: 0; padding-bottom: 10px; }
  .standings-head span { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--muted); }
  .standings-head:hover { background: none; }

  .tiebreak-info { display: inline-flex; align-items: center; justify-content: center; width: 15px; height: 15px; border-radius: 50%; background: var(--surface3); color: var(--accent); font-size: 11px; font-style: normal; cursor: help; flex-shrink: 0; }
  .standings-legend { margin-top: 14px; padding: 18px 16px 4px; font-size: 11px; line-height: 1.6; color: var(--muted); border-top: 2px solid var(--border2); }
  .standings-legend-title { font-family: var(--font-body); font-size: 12px; font-weight: 800; letter-spacing: 1.5px; color: var(--text); margin-bottom: 6px; text-transform: uppercase; }
  .standings-legend ol { margin: 0; padding-left: 18px; }
  .standings-legend li { margin-bottom: 4px; }
  .standings-legend li:last-child { margin-bottom: 0; }
  .standings-legend ol ol { list-style: lower-alpha; margin-top: 4px; padding-left: 16px; }
  .standings-legend ol ol li { margin-bottom: 2px; }

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
  .profile-dropdown { position: absolute; top: calc(100% + 10px); right: 28px; width: 320px; max-width: calc(100vw - 40px); max-height: calc(100vh - 90px); overflow-y: auto; border-radius: 16px; z-index: 300; animation: dropIn 0.16s ease; }
  /* Mobile Chrome doesn't reliably render backdrop-filter, and the shared
     .glass background alone (60% opacity) isn't enough to hide page content
     behind — override with a near-solid background just for this dropdown,
     since it sits directly over other real content rather than empty page
     background like other glass cards do. */
  .profile-dropdown.glass { background: var(--surface-solid); }
  .profile-dropdown .form-select { font-size: 13.5px; padding: 10px 12px; }
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
  .league-code-pill { display: inline-flex; align-items: center; gap: 8px; padding: 4px 6px 4px 10px; border-radius: 20px; background: var(--surface2); border: 1px solid var(--border); }
  .league-code-pill-label { font-size: 9px; font-weight: 800; letter-spacing: 1px; color: var(--muted); }
  .league-code-pill code { font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; font-size: 15px; font-weight: 700; letter-spacing: 1px; color: var(--gold); background: none; padding: 0; }
  .league-code-copy { border: none; cursor: pointer; padding: 4px 12px; border-radius: 14px; font-size: 10.5px; font-weight: 700; background: var(--accent); color: #fff; }
  .league-code-copy:hover { filter: brightness(1.1); }

  /* ADMIN PANEL — larger, more legible text throughout (bumped up from the
     app's default compact sizing per feedback that it was hard to read). */
  .admin-panel { font-size: 15px; }
  .admin-panel .chip { font-size: 13.5px; padding: 7px 16px; font-weight: 700; }
  .admin-panel .form-label { font-size: 13px; }
  .admin-panel .form-select, .admin-panel .form-input { font-size: 15px; }
  .admin-panel .standings-row { font-size: 15px; }
  .admin-panel p { line-height: 1.5; }
  .admin-panel .btn-sm { font-size: 13px; padding: 8px 16px; }
  .admin-panel .score-input { font-size: 15px; }

  /* Shared keyframes used by the animated logo intro (components/Logo.jsx) */
  @keyframes draw-ring { to { stroke-dashoffset: 0; } }
  @keyframes bolt-strike { 0% { opacity: 0; transform: scale(0.5) rotate(-8deg); } 60% { opacity: 1; transform: scale(1.15) rotate(3deg); } 100% { opacity: 1; transform: scale(1) rotate(0deg); } }
  @keyframes slide-in-left { to { opacity: 1; transform: translateX(0); } }
  @keyframes slide-in-right { to { opacity: 1; transform: translateX(0); } }
  @keyframes fade-up { to { opacity: 1; } }
  @keyframes pulse-bar { 0%, 100% { width: 20%; margin-left: 0%; } 50% { width: 60%; margin-left: 40%; } }

  /* MOBILE — the app had zero responsive breakpoints until real phone
     testing surfaced actual overlap bugs (not just "could look nicer"):
     fixed-width standings columns didn't leave room for player names, and
     fixture cards let long team names collide with the score inputs. */
  @media (max-width: 560px) {
    .standings-row { gap: 4px; padding: 10px 8px; }
    .standings-col-rank { width: 22px; font-size: 15px; }
    .standings-col-stat { width: 42px; font-size: 11px; }
    .standings-col-pts { width: 46px; }
    .standings-col-move { width: 16px; }
    .standings-head span { font-size: 8px; letter-spacing: 0.2px; }
    .standings-name { font-size: 12.5px; display: inline-block; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: middle; }
    .standings-pts { font-size: 16px; }

    .fixture-body { flex-direction: column; align-items: stretch; }
    .fixture-action { width: 100%; }
    .fixture-action .score-input { flex: 1; min-width: 0; }
  }
`;
