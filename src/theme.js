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

  body {
    background: var(--bg); background-image: var(--bg-grad); background-attachment: fixed;
    color: var(--text); font-family: var(--font-body); min-height: 100vh;
    /* Stops iOS auto-inflating text in landscape, and kills the grey flash
       box Android draws over every tapped element. */
    -webkit-text-size-adjust: 100%;
    -webkit-tap-highlight-color: transparent;
    /* Dark/light used to swap instantly, which reads as a glitch. Only the
       page-level colours are transitioned — doing it globally would make
       every hover in the app feel laggy. */
    transition: background-color 0.35s ease, color 0.35s ease;
  }

  /* Keyboard users could previously not see where they were at all — the
     inputs swapped border colour but buttons, tabs and chips showed nothing.
     :focus-visible means mouse clicks stay clean; only keyboard focus rings. */
  :focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 6px; }
  .btn:focus-visible, .nav-tab:focus-visible, .chip:focus-visible { outline-offset: 3px; }

  ::-webkit-scrollbar { width: 5px; height: 5px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--surface3); border-radius: 3px; }

  /* Horizontally scrolling strips (the dashboard's upcoming games) get a
     deliberately VISIBLE scrollbar. The 5px near-transparent default gave no
     hint that the row scrolled at all, so half the week's fixtures were
     effectively hidden. */
  .hscroll {
    display: flex; gap: 12px; overflow-x: auto;
    padding-bottom: 14px;
    scrollbar-width: thin;                       /* Firefox */
    scrollbar-color: var(--accent) var(--surface2);
    /* Fades the right edge while there's more to scroll to — a second,
       colour-independent hint that the row continues. */
    scroll-snap-type: x proximity;
  }
  .hscroll > * { scroll-snap-align: start; }
  .hscroll::-webkit-scrollbar { height: 10px; }
  .hscroll::-webkit-scrollbar-track {
    background: var(--surface2); border-radius: 10px; margin: 0 2px;
  }
  .hscroll::-webkit-scrollbar-thumb {
    background: linear-gradient(90deg, var(--accent), #06d6f7);
    border-radius: 10px; border: 2px solid transparent; background-clip: padding-box;
  }
  .hscroll::-webkit-scrollbar-thumb:hover { background: var(--accent); }

  .app { min-height: 100vh; display: flex; flex-direction: column; }

  /* Footer — scrolls with the page, not fixed/sticky (no floating bars
     eating into phone screen space). */
  /* HOW IT WORKS explainer */
  .howto-section { margin-bottom: 18px; }
  .howto-heading { font-size: 12px; font-weight: 800; letter-spacing: 0.6px; text-transform: uppercase; color: var(--accent); margin-bottom: 6px; }
  .howto-section p { font-size: 13px; line-height: 1.6; color: var(--muted); }
  .help-btn {
    display: inline-flex; align-items: center; justify-content: center;
    width: 30px; height: 30px; border-radius: 50%; cursor: pointer;
    background: var(--surface2); border: 1px solid var(--border); color: var(--muted);
    font-size: 14px; font-weight: 800; transition: all 0.18s; flex-shrink: 0;
  }
  .help-btn:hover { color: var(--accent); border-color: var(--accent); }

  /* A button that reads as a text link — used for the sign-in / sign-up mode
     switches, which were plain spans and therefore unreachable by keyboard. */
  .link-btn {
    background: none; border: none; padding: 0; cursor: pointer;
    font-family: var(--font-body); font-size: 12px; color: var(--muted);
    text-decoration: none;
  }
  .link-btn:hover { color: var(--accent); text-decoration: underline; }

  .app-footer {
    padding: 28px 24px 20px; text-align: center; margin-top: auto;
    padding-bottom: calc(20px + env(safe-area-inset-bottom, 0px));
  }
  .app-footer-creator { font-size: 11px; font-weight: 800; letter-spacing: 0.6px; color: var(--muted); margin-bottom: 6px; }
  .app-footer-legal { font-size: 9.5px; line-height: 1.5; color: var(--muted); opacity: 0.55; max-width: 640px; margin: 0 auto; }

  .glass {
    background: var(--surface);
    backdrop-filter: blur(var(--blur));
    -webkit-backdrop-filter: blur(var(--blur));
    border: 1px solid var(--border);
  }

  /* HEADER */
  /* Header + nav travel together as one sticky unit. */
  .topbar {
    position: sticky; top: 0; z-index: 100;
    background: ${dark ? "rgba(10,10,16,0.92)" : "rgba(255,255,255,0.92)"};
    backdrop-filter: blur(var(--blur)); -webkit-backdrop-filter: blur(var(--blur));
  }
  .header {
    display: flex; align-items: center; justify-content: space-between;
    /* env(safe-area-inset-*) keeps the header clear of the notch and the
       rounded corners once the app is installed to the home screen. */
    padding: 14px 28px; padding-top: calc(14px + env(safe-area-inset-top, 0px));
    padding-left: calc(28px + env(safe-area-inset-left, 0px));
    padding-right: calc(28px + env(safe-area-inset-right, 0px));
    border-bottom: 1px solid var(--border);
  }
  .brand { display: flex; align-items: center; gap: 10px; cursor: pointer; }
  .brand-word { font-family: var(--font-display); font-size: 22px; letter-spacing: 1px; color: var(--accent); }
  .brand-word span { color: var(--accent2); }

  /* NAV — the header and nav are stuck to the top together as one unit (see
     .topbar) rather than the nav guessing the header's height with a magic
     pixel offset, which would drift the moment the header grew (a notch, a
     font change). */
  .nav {
    display: flex; align-items: center; gap: 6px;
    padding: 8px 24px;
    padding-left: calc(24px + env(safe-area-inset-left, 0px));
    padding-right: calc(24px + env(safe-area-inset-right, 0px));
    overflow-x: auto; scrollbar-width: none;
    border-bottom: 1px solid var(--border);
  }
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

  .main {
    flex: 1; max-width: 1080px; margin: 0 auto; width: 100%;
    padding: 24px 28px;
    padding-left: calc(28px + env(safe-area-inset-left, 0px));
    padding-right: calc(28px + env(safe-area-inset-right, 0px));
  }

  /* Empty states — a centred, quieter block rather than a bare sentence
     sitting flush-left in a card. */
  .empty-state { text-align: center; padding: 28px 20px; color: var(--muted); }
  .empty-state-icon { font-size: 30px; line-height: 1; margin-bottom: 10px; opacity: 0.8; }
  .empty-state-title { font-size: 14px; font-weight: 700; color: var(--text); margin-bottom: 4px; }
  .empty-state-sub { font-size: 12.5px; line-height: 1.55; max-width: 380px; margin: 0 auto; }

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

  /* Press feedback. Touch devices have no hover, so without an :active state
     every tap felt inert — nothing acknowledged the press until the data
     changed. */
  .btn:active:not(:disabled) { transform: scale(0.96); }
  .nav-tab:active, .chip:active, .help-btn:active, .league-code-copy:active { transform: scale(0.96); }
  .avatar-option:active { transform: scale(0.9); }

  /* Momentary "it saved" state — the button used to just quietly disable
     itself, which on a flaky phone connection is indistinguishable from
     nothing having happened. */
  .save-error { font-size: 11px; color: var(--accent2); font-weight: 600; }

  .btn-saved, .btn-saved:disabled {
    background: rgba(34,197,94,0.18) !important; color: var(--green) !important;
    opacity: 1 !important; border: 1px solid rgba(34,197,94,0.45);
  }

  /* Avatar picker — there was previously no way to tell which one you'd
     chosen; every tile looked identical. */
  .avatar-option {
    aspect-ratio: 1; border-radius: 10px; border: 1px solid var(--border);
    background: var(--surface2); display: flex; align-items: center; justify-content: center;
    font-size: 18px; cursor: pointer; transition: transform 0.15s, border-color 0.15s, background 0.15s;
  }
  .avatar-option:hover { border-color: var(--border2); background: var(--surface3); transform: translateY(-1px); }
  .avatar-option.selected {
    border-color: var(--accent); background: rgba(59,130,246,0.18);
    box-shadow: 0 0 0 1px var(--accent), 0 0 14px var(--accent-glow);
  }

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
  /* Native dropdown options can't inherit the app's surface colours, so they
     need explicit values — and they must follow the theme. This was hardcoded
     dark, which made every dropdown unreadable in light mode (dark option
     background under dark option text). */
  .form-select option { background: ${dark ? "#14141d" : "#ffffff"}; color: var(--text); }

  .page-title { font-family: var(--font-display); font-size: 32px; letter-spacing: 1px; margin-bottom: 4px; }
  .page-sub { font-size: 13px; color: var(--muted); margin-bottom: 24px; }

  .card { border-radius: var(--r2); padding: 22px; }
  .card-title { font-family: var(--font-display); font-size: 15px; letter-spacing: 1px; color: var(--muted); margin-bottom: 16px; }

  .grid-2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-bottom: 24px; }
  .grid-4 { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 14px; }

  /* STAT CARDS */
  .stat-card { border-radius: var(--r2); padding: 18px 20px; display: flex; flex-direction: column; gap: 4px; position: relative; overflow: hidden; transition: transform 0.2s; }
  .stat-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: var(--card-accent, linear-gradient(90deg, var(--accent), #06d6f7)); }
  .stat-card:hover { transform: translateY(-2px); }
  .stat-card-val { font-family: var(--font-display); font-size: 36px; letter-spacing: 1px; line-height: 1; }
  .stat-card-label { font-size: 11px; color: var(--muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; }

  /* TEAM BADGE — colored chip with emoji (or abbr fallback), never a logo image */
  .team-badge { display: inline-flex; align-items: center; gap: 8px; padding: 5px 10px 5px 6px; border-radius: 20px; font-weight: 700; font-size: 13px; max-width: 100%; min-width: 0; }
  .team-badge-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
  .team-badge-icon { width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; }
  .team-badge-abbr { font-size: 10px; letter-spacing: 0.5px; }

  /* FIXTURE / PREDICTION ROWS */
  .fixture-card { border-radius: var(--r2); margin-bottom: 10px; overflow: hidden; transition: border-color 0.2s, box-shadow 0.2s; position: relative; }
  .fixture-card:hover { border-color: var(--border2); }

  /* Team-coloured cards. The two teams' real primary colours bleed in from
     their own side of the card at low opacity, so a matchup is recognisable
     at a glance instead of every game looking identical. Kept as a separate
     painted layer beneath the content — it never sits behind text at a
     strength that could affect contrast, which matters because several teams'
     primaries are near-black. */
  .team-tinted::before {
    content: ''; position: absolute; inset: 0; pointer-events: none;
    background:
      linear-gradient(100deg, var(--away-color, transparent) 0%, transparent 38%),
      linear-gradient(260deg, var(--home-color, transparent) 0%, transparent 38%);
    opacity: ${dark ? 0.22 : 0.13};
  }
  .team-tinted > * { position: relative; z-index: 1; }
  .team-tinted:hover::before { opacity: ${dark ? 0.3 : 0.18}; }

  /* ── PICK ROW ──────────────────────────────────────────────────────────
     One tap per game. Two large targets with a narrow tie strip between:
     NFL ties are around 0.5% of games, so giving "Tie" equal width would
     shrink the two options people actually use on the smallest screens. */
  .pick-row { display: grid; grid-template-columns: 1fr 54px 1fr; gap: 8px; padding: 4px 14px 14px; position: relative; z-index: 1; }
  .pick-option {
    display: flex; align-items: center; justify-content: center;
    min-height: 54px; padding: 10px 8px; border-radius: 14px; cursor: pointer;
    background: var(--surface2); border: 1.5px solid var(--border); color: var(--text);
    font-family: var(--font-body); transition: all 0.15s; min-width: 0;
  }
  .pick-option:hover:not(:disabled) { border-color: var(--side-color, var(--border2)); background: var(--surface3); }
  .pick-option:active:not(:disabled) { transform: scale(0.97); }
  .pick-option:disabled { cursor: default; opacity: 0.75; }
  /* THE selected state. Deliberately does NOT use the team's own colour.
     Team colours range from near-black (Browns, Ravens, Jets) to bright, so a
     tint built from them was invisible for a third of the league — you
     genuinely could not tell which side you'd picked. This is one fixed,
     high-contrast treatment that reads identically for all 32 teams. */
  .pick-option.chosen {
    border-color: var(--accent);
    border-width: 2px;
    background: linear-gradient(135deg, rgba(59,130,246,0.30), rgba(59,130,246,0.14));
    box-shadow: 0 0 0 2px var(--accent-glow), 0 4px 20px rgba(59,130,246,0.30);
    font-weight: 800;
    transform: translateY(-1px);
  }
  /* A tick in the corner, so the state survives colour-blindness and doesn't
     rest on hue alone. */
  .pick-option.chosen::after {
    content: "✓";
    position: absolute; top: -8px; right: -6px;
    width: 20px; height: 20px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    background: var(--accent); color: #fff; font-size: 11px; font-weight: 900;
    box-shadow: 0 2px 8px rgba(0,0,0,0.45);
  }
  .pick-option { position: relative; }
  /* Once a side is chosen the other one recedes. Contrast between the two
     options does more work than the highlight alone. */
  .pick-row.has-pick .pick-option:not(.chosen):not(.actual):not(.was-right) {
    opacity: 0.4; filter: saturate(0.45);
  }
  .pick-row.has-pick .pick-option:not(.chosen):hover:not(:disabled) { opacity: 0.75; filter: none; }
  /* Once a game is final, the row grades itself at a glance. */
  /* After the whistle, the result overrides the blue "this is my pick" look —
     green if you called it, red if you didn't. Both override .chosen, hence
     the extra specificity. */
  .pick-option.chosen.was-right, .pick-option.was-right {
    border-color: var(--green); background: rgba(34,197,94,0.20);
    box-shadow: 0 0 0 2px rgba(34,197,94,0.45);
  }
  .pick-option.chosen.was-right::after { background: var(--green); }
  .pick-option.chosen.was-wrong, .pick-option.was-wrong {
    border-color: rgba(244,63,94,0.6); background: rgba(244,63,94,0.12);
    box-shadow: none; transform: none; opacity: 0.8;
  }
  .pick-option.chosen.was-wrong::after { content: "✕"; background: var(--accent2); }
  .pick-option.actual { border-style: dashed; border-color: rgba(34,197,94,0.55); }
  .pick-option-tie {
    font-size: 10.5px; font-weight: 800; letter-spacing: 1px; color: var(--muted);
    --side-color: var(--gold);
  }
  .pick-option-tie.chosen { color: var(--gold); }
  .final-badge {
    display: inline-flex; align-items: center; margin-left: 8px; padding: 2px 10px;
    border-radius: 20px; font-size: 10.5px; font-weight: 800;
    background: var(--surface3); color: var(--text);
  }
  .fixture-card.locked .fixture-body { opacity: 0.55; }
  /* A saved pick used to be signalled only by a faint border tint, which was
     easy to miss when scanning sixteen near-identical cards. Now the card
     carries a green edge and an explicit badge stating the pick. */
  .fixture-card.predicted { border-color: rgba(34,197,94,0.35); box-shadow: inset 3px 0 0 var(--green); }
  .picked-badge {
    display: inline-flex; align-items: center; gap: 4px; margin-left: 8px;
    padding: 2px 10px; border-radius: 20px; font-size: 10.5px; font-weight: 800;
    background: rgba(34,197,94,0.14); color: var(--green); border: 1px solid rgba(34,197,94,0.35);
    /* Now carries a full team name, so it must not break mid-name. */
    white-space: nowrap;
  }
  .unsaved-badge {
    display: inline-flex; align-items: center; gap: 4px; margin-left: 8px;
    padding: 2px 10px; border-radius: 20px; font-size: 10.5px; font-weight: 800;
    background: rgba(245,158,11,0.14); color: var(--gold); border: 1px solid rgba(245,158,11,0.4);
  }

  /* Week-level bulk actions */
  .bulk-actions { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; flex-wrap: wrap; }
  .bulk-hint { font-size: 11px; color: var(--muted); }

  /* Weekly-winner badges */
  .week-badge { font-size: 11px; font-weight: 800; cursor: help; flex-shrink: 0; letter-spacing: -0.3px; }
  .badge-strip { display: flex; flex-wrap: wrap; gap: 8px; }
  .badge-medal {
    display: inline-flex; flex-direction: column; align-items: center; gap: 2px;
    padding: 8px 12px; border-radius: 12px; cursor: help;
    background: linear-gradient(180deg, rgba(245,158,11,0.20), rgba(245,158,11,0.05));
    border: 1px solid rgba(245,158,11,0.4);
  }
  .badge-medal.acc-sweep { background: linear-gradient(180deg, rgba(59,130,246,0.22), rgba(59,130,246,0.05)); border-color: rgba(59,130,246,0.45); }
  .badge-medal.acc-sweep .badge-medal-week { color: var(--accent); }
  .badge-medal.acc-near { background: linear-gradient(180deg, rgba(34,197,94,0.20), rgba(34,197,94,0.05)); border-color: rgba(34,197,94,0.42); }
  .badge-medal.acc-near .badge-medal-week { color: var(--green); }
  .badge-medal.acc-sharp { background: linear-gradient(180deg, rgba(168,85,247,0.20), rgba(168,85,247,0.05)); border-color: rgba(168,85,247,0.42); }
  .badge-medal.acc-sharp .badge-medal-week { color: #a855f7; }
  .badge-medal-icon { font-size: 20px; line-height: 1; }
  .badge-medal-week { font-size: 9px; font-weight: 800; letter-spacing: 1px; color: var(--gold); }

  /* SEASON CHART — hand-drawn SVG, no charting library */
  .chart-wrap { width: 100%; overflow: hidden; }
  .season-chart { width: 100%; height: auto; display: block; }
  .chart-grid { stroke: var(--border); stroke-width: 1; }
  .chart-axis-label { fill: var(--muted); font-size: 11px; font-family: var(--font-body); }
  .chart-legend { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 14px; }
  .chart-legend-item {
    display: inline-flex; align-items: center; gap: 7px; cursor: pointer;
    padding: 5px 11px; border-radius: 20px; font-size: 11.5px;
    background: var(--surface2); border: 1px solid var(--border); color: var(--text);
    transition: opacity 0.15s, border-color 0.15s;
  }
  .chart-legend-item:hover { border-color: var(--border2); }
  .chart-legend-item.off { opacity: 0.4; }
  .chart-legend-item.off .chart-legend-name { text-decoration: line-through; }
  .chart-legend-item b { font-family: var(--font-display); font-size: 13px; letter-spacing: 0.5px; }
  .chart-swatch { width: 10px; height: 10px; border-radius: 3px; flex-shrink: 0; }
  .chart-legend-name { max-width: 130px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  /* WEEKLY RECAP — the week in numbers, above the individual callouts */
  .recap { padding-bottom: 14px; margin-bottom: 14px; border-bottom: 1px solid var(--border); }
  .recap-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 10px; }
  .recap-stat { background: var(--surface2); border: 1px solid var(--border); border-radius: 12px; padding: 10px 12px; min-width: 0; }
  .recap-stat b {
    display: block; font-family: var(--font-display); font-size: 18px; letter-spacing: 0.5px;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .recap-stat span { display: block; font-size: 10.5px; color: var(--muted); margin-top: 2px; text-transform: uppercase; letter-spacing: 0.5px; }
  .recap-movers { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
  .recap-mover { font-size: 12px; padding: 5px 11px; border-radius: 20px; background: var(--surface2); border: 1px solid var(--border); }
  .recap-mover.up { color: var(--green); }
  .recap-mover.down { color: var(--accent2); }
  .recap-games { display: flex; flex-direction: column; gap: 6px; margin-top: 10px; }
  .recap-game { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 12px; color: var(--muted); }
  .recap-game-tag { font-size: 9.5px; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase; padding: 3px 8px; border-radius: 20px; }
  .recap-game-tag.tough { background: rgba(244,63,94,0.14); color: var(--accent2); }
  .recap-game-tag.easy { background: rgba(34,197,94,0.14); color: var(--green); }
  .recap-game-note { margin-left: auto; font-size: 11px; }

  /* Closest-rival callout */
  .rival-card { margin-bottom: 24px; cursor: pointer; border-left: 3px solid var(--accent2); }
  .rival-card:hover { border-color: var(--border2); border-left-color: var(--accent2); }
  .rival-label { font-size: 10px; font-weight: 800; letter-spacing: 1.4px; text-transform: uppercase; color: var(--muted); margin-bottom: 10px; }
  .rival-body { display: flex; align-items: center; gap: 12px; }
  .rival-text { flex: 1; font-size: 13px; line-height: 1.45; min-width: 0; }
  .rival-gap { font-family: var(--font-display); font-size: 24px; letter-spacing: 0.5px; flex-shrink: 0; }
  .rival-gap.leading { color: var(--green); }
  .rival-gap.behind { color: var(--accent2); }
  .fixture-meta { padding: 10px 18px 0; font-size: 11px; color: var(--text); opacity: 0.7; letter-spacing: 0.2px; }
  .fixture-body { display: flex; align-items: center; gap: 14px; padding: 10px 18px 14px; flex-wrap: wrap; }
  .fixture-teams { flex: 1; display: flex; flex-direction: column; gap: 6px; min-width: 0; }
  .fixture-team-row { display: flex; align-items: center; }
  .fixture-vs { padding-left: 34px; font-size: 10px; color: var(--muted); letter-spacing: 1px; }
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
  .reveal-correct { color: var(--green); font-weight: 600; }
  .reveal-wrong { color: var(--muted); }
  .reveal-none { color: var(--muted); font-style: italic; }

  /* Dashboard highlights ("announcement board") */
  .highlight-row { font-size: 13px; line-height: 1.5; padding: 10px 14px; border-radius: 10px; background: var(--surface2); }
  /* Badge shoutouts get their tier's colour so a Clean Sweep reads as a bigger
     deal than a Sharp Week at a glance. */
  .badge-shout { border-left: 3px solid var(--border2); }
  .badge-shout.acc-sweep { border-left-color: var(--accent); background: rgba(59,130,246,0.10); }
  .badge-shout.acc-near { border-left-color: var(--green); background: rgba(34,197,94,0.09); }
  .badge-shout.acc-sharp { border-left-color: #a855f7; background: rgba(168,85,247,0.09); }

  /* A playoff game whose teams aren't known yet — present so people can see
     what's coming, but obviously not pickable. */
  .fixture-card.playoff-pending { opacity: 0.6; border-style: dashed; }

  /* SEASON COUNTDOWN — the app has no data at all before kickoff, so this
     carries the whole preseason. */
  .countdown-card { text-align: center; border-color: rgba(59,130,246,0.28); }
  .countdown-label { font-size: 10.5px; font-weight: 800; letter-spacing: 1.6px; text-transform: uppercase; color: var(--muted); margin-bottom: 12px; }
  .countdown-clock { display: flex; justify-content: center; gap: 10px; flex-wrap: wrap; margin-bottom: 20px; }
  .countdown-unit {
    display: flex; flex-direction: column; align-items: center; gap: 2px;
    min-width: 66px; padding: 12px 6px; border-radius: 14px;
    background: var(--surface2); border: 1px solid var(--border);
  }
  .countdown-unit b { font-family: var(--font-display); font-size: 30px; line-height: 1; letter-spacing: 1px;
    background: linear-gradient(135deg, var(--accent), #06d6f7); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .countdown-unit i { font-style: normal; font-size: 9.5px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: var(--muted); }
  .countdown-opener { border-radius: 14px; padding: 14px; border: 1px solid var(--border); margin-bottom: 16px; position: relative; overflow: hidden; }
  .countdown-opener-label { font-size: 9.5px; font-weight: 800; letter-spacing: 1.2px; text-transform: uppercase; color: var(--muted); margin-bottom: 10px; }
  .countdown-opener-teams { display: flex; align-items: center; justify-content: center; gap: 10px; flex-wrap: wrap; }
  .countdown-opener-when { font-size: 11.5px; color: var(--muted); margin-top: 10px; }
  .countdown-picks { border-top: 1px solid var(--border); padding-top: 16px; text-align: left; max-width: 420px; margin: 0 auto; }
  .countdown-picks-title { font-size: 13px; font-weight: 800; color: var(--text); margin-bottom: 4px; }
  .countdown-picks-sub { font-size: 11.5px; color: var(--muted); line-height: 1.5; margin-bottom: 12px; }
  .countdown-picks-list { display: flex; flex-direction: column; gap: 8px; }
  .countdown-pick-row { display: grid; grid-template-columns: 1fr 70px 34px; align-items: center; gap: 10px; font-size: 12px; color: var(--muted); }
  .countdown-pick-row.done { color: var(--green); }
  .countdown-pick-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .countdown-pick-count { font-family: var(--font-display); font-size: 13px; letter-spacing: 0.5px; text-align: right; color: var(--text); }
  .countdown-pick-row.done .countdown-pick-count { color: var(--green); }
  .countdown-pick-bar { display: block; height: 5px; border-radius: 3px; background: var(--surface3); overflow: hidden; }
  .countdown-pick-fill { display: block; height: 100%; border-radius: 3px; background: linear-gradient(90deg, var(--accent), #06d6f7); transition: width 0.4s ease; }
  .countdown-pick-row.done .countdown-pick-fill { background: linear-gradient(90deg, var(--green), #4ade80); }

  /* Dashboard "you still have picks to make" nudge */
  .pick-progress { margin-bottom: 24px; cursor: pointer; border-left: 3px solid var(--gold); }
  .pick-progress:hover { border-color: var(--border2); border-left-color: var(--gold); }
  .pick-progress-head { display: flex; align-items: center; justify-content: space-between; font-size: 13px; margin-bottom: 10px; }
  .pick-progress-head b { font-family: var(--font-display); font-size: 17px; letter-spacing: 0.5px; color: var(--gold); }
  .pick-progress-bar { display: block; height: 6px; border-radius: 3px; background: var(--surface3); overflow: hidden; }
  .pick-progress-fill { display: block; height: 100%; border-radius: 3px; background: linear-gradient(90deg, var(--gold), #fbbf24); transition: width 0.4s ease; }
  .pick-progress-hint { font-size: 11.5px; color: var(--muted); margin-top: 8px; }

  /* Predictions per-week progress */
  .week-progress { display: flex; flex-direction: column; gap: 6px; min-width: 190px; flex: 1; max-width: 300px; }
  .week-progress-text { font-size: 12px; color: var(--muted); }
  .week-progress-text b { color: var(--text); font-size: 13px; }
  .week-progress-done { color: var(--green); font-weight: 700; }
  .week-progress-bar { display: block; height: 5px; border-radius: 3px; background: var(--surface3); overflow: hidden; }
  .week-progress-fill { display: block; height: 100%; border-radius: 3px; background: linear-gradient(90deg, var(--accent), #06d6f7); transition: width 0.4s ease; }
  .week-progress-fill.done { background: linear-gradient(90deg, var(--green), #4ade80); }

  /* NFL STANDINGS */
  .conf-heading { font-family: var(--font-display); font-size: 18px; letter-spacing: 2px; margin-bottom: 12px; padding-left: 2px; }
  .conf-heading.afc { color: var(--accent2); }
  .conf-heading.nfc { color: var(--accent); }
  .nfl-row { display: flex; align-items: center; gap: 12px; padding: 9px 10px; border-radius: 10px; }
  .nfl-row:hover { background: var(--surface2); }
  .nfl-row.leader { background: rgba(245,158,11,0.08); }
  .nfl-row-team { display: flex; align-items: center; gap: 6px; min-width: 0; flex: 1; }
  .nfl-crown { font-size: 12px; flex-shrink: 0; }
  .nfl-row-bar { width: 70px; flex-shrink: 0; }
  .nfl-bar { display: block; height: 5px; border-radius: 3px; background: var(--surface3); overflow: hidden; }
  .nfl-bar-fill { display: block; height: 100%; border-radius: 3px; background: linear-gradient(90deg, var(--accent), #06d6f7); }
  .nfl-row.leader .nfl-bar-fill { background: linear-gradient(90deg, var(--gold), #fbbf24); }
  .nfl-row-rec { font-family: var(--font-display); font-size: 15px; letter-spacing: 0.5px; width: 62px; text-align: right; flex-shrink: 0; }

  /* WEEKLY STANDINGS */
  .standings-row.week-winner { background: rgba(245,158,11,0.10); }
  .winbar { display: block; height: 6px; border-radius: 3px; background: var(--surface3); overflow: hidden; }
  .winbar-fill { display: block; height: 100%; border-radius: 3px; background: linear-gradient(90deg, var(--gold), #fbbf24); transition: width 0.4s ease; }

  /* HEAD TO HEAD */
  .h2h-head { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 12px; margin-bottom: 18px; }
  .h2h-side { display: flex; flex-direction: column; align-items: center; gap: 8px; min-width: 0; }
  .h2h-name { font-size: 12.5px; font-weight: 700; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .h2h-name.you { color: var(--accent2); }
  .h2h-score { text-align: center; }
  .h2h-points { font-family: var(--font-display); font-size: 34px; letter-spacing: 1px; line-height: 1; }
  .h2h-dash { color: var(--muted); }
  .h2h-verdict { font-size: 11px; color: var(--muted); margin-top: 6px; }
  .h2h-stats { display: flex; flex-direction: column; gap: 2px; border-top: 1px solid var(--border); padding-top: 12px; }
  .h2h-stat { display: grid; grid-template-columns: 44px 1fr 44px; align-items: center; font-size: 11.5px; color: var(--muted); padding: 5px 0; }
  .h2h-stat b { font-family: var(--font-display); font-size: 16px; color: var(--text); }
  .h2h-stat b:first-child { text-align: left; }
  .h2h-stat b:last-child { text-align: right; }
  .h2h-stat span { text-align: center; }
  .h2h-row { position: relative; overflow: hidden; border: 1px solid var(--border); border-radius: 12px; padding: 10px 12px; margin-bottom: 8px; }
  .h2h-row-game { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 12px; margin-bottom: 8px; }
  .h2h-final { color: var(--muted); font-size: 11px; margin-left: auto; }
  .h2h-row-picks { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .h2h-pick { font-size: 12.5px; padding: 5px 10px; border-radius: 8px; background: var(--surface2); border: 1px solid var(--border); text-align: center; }
  .h2h-pick em { font-style: normal; font-size: 10.5px; opacity: 0.8; margin-left: 4px; }
  .h2h-pick.won { background: rgba(34,197,94,0.14); border-color: rgba(34,197,94,0.4); color: var(--green); font-weight: 700; }
  .h2h-pick.lost { opacity: 0.6; }

  /* The dashboard's headline number gets its own weight — four identical
     cards gave the eye nowhere to land. */
  .stat-card.primary { border-color: rgba(59,130,246,0.35); box-shadow: 0 0 24px rgba(59,130,246,0.10); }
  .stat-card.primary .stat-card-val { font-size: 44px; }

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

  /* Your own row, highlighted as a whole. A red name alone was easy to miss
     in a long table — this makes "where am I" answerable at a glance. The
     left bar does the work; the tint stays subtle so it never competes with
     the medal/podium colours or the week-winner highlight. */
  .standings-row.is-me {
    background: rgba(244,63,94,0.09);
    box-shadow: inset 3px 0 0 var(--accent2);
  }
  .standings-row.is-me:hover { background: rgba(244,63,94,0.14); }
  .standings-row.week-winner.is-me { background: rgba(245,158,11,0.12); }
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
  .standings-col-player { flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; }
  .standings-player-info { min-width: 0; display: flex; flex-direction: column; gap: 1px; }
  .standings-player-line { display: flex; align-items: center; gap: 8px; min-width: 0; }
  /* Desktop has dedicated stat columns, so this duplicate is hidden until
     the mobile breakpoint needs it. */
  .standings-substats { display: none; font-size: 10.5px; color: var(--muted); }
  .standings-col-stat { width: 84px; flex-shrink: 0; text-align: center; }
  .standings-col-pts { width: 74px; flex-shrink: 0; text-align: right; }
  .standings-col-move { width: 30px; flex-shrink: 0; display: flex; justify-content: center; }
  .standings-head { padding-top: 0; padding-bottom: 10px; }
  .standings-head span { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--muted); }
  .standings-head:hover { background: none; }

  .tiebreak-info { display: inline-flex; align-items: center; justify-content: center; width: 15px; height: 15px; border-radius: 50%; background: var(--surface3); color: var(--accent); font-size: 11px; font-style: normal; cursor: help; flex-shrink: 0; }
  /* Sits beside the bonus total rather than after a name, so it needs its own
     spacing and a gold tint to read as "there's more detail here". */
  .bonus-info { margin-left: 5px; width: 14px; height: 14px; font-size: 10px; color: var(--gold); vertical-align: middle; }

  /* SEASON PICKS — a made pick should be obvious at a glance, since these are
     set once in August and then not looked at for months. Green edge on the
     row, green border on the select, and a confirmation chip. */
  .special-pick-row { border-left: 3px solid transparent; transition: background 0.2s, border-color 0.2s; }
  .special-pick-row.has-pick { border-left-color: var(--green); background: rgba(34,197,94,0.07); }
  .form-select.has-pick { border-color: rgba(34,197,94,0.5); }
  .special-pick-state { display: flex; align-items: center; justify-content: flex-end; min-width: 84px; flex-shrink: 0; }
  /* Briefly pulses when a pick lands, then settles back to "✓ Picked". */
  .saved-flash { animation: saved-pop 0.35s ease; }
  @keyframes saved-pop {
    0% { transform: scale(0.8); opacity: 0; }
    60% { transform: scale(1.08); }
    100% { transform: scale(1); opacity: 1; }
  }
  @media (prefers-reduced-motion: reduce) { .saved-flash { animation: none; } }
  @media (max-width: 560px) {
    /* The chip and the dropdown won't sit side by side on a phone. */
    .special-pick-row { flex-wrap: wrap; }
    .special-pick-state { min-width: 0; order: 3; }
    .special-pick-row .form-select { flex: 1; }
  }
  /* Mobile-only: the ⓘ tooltip needs a hover, which a phone doesn't have, so
     the breakdown is printed under the name instead. */
  .standings-substats-bonus { display: block; margin-top: 1px; letter-spacing: 0.5px; }
  .standings-legend { margin-top: 14px; padding: 18px 16px 4px; font-size: 11px; line-height: 1.6; color: var(--muted); border-top: 2px solid var(--border2); }
  .standings-legend-title { font-family: var(--font-body); font-size: 12px; font-weight: 800; letter-spacing: 1.5px; color: var(--text); margin-bottom: 6px; text-transform: uppercase; }
  .standings-legend ol { margin: 0; padding-left: 18px; }
  .standings-legend li { margin-bottom: 4px; }
  .standings-legend li:last-child { margin-bottom: 0; }
  .standings-legend ol ol { list-style: lower-alpha; margin-top: 4px; padding-left: 16px; }
  .standings-legend ol ol li { margin-bottom: 2px; }

  /* MODALS */
  .modal-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.6);
    backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
    display: flex; align-items: center; justify-content: center; z-index: 500; padding: 20px;
    animation: overlay-in 0.18s ease both;
  }
  .modal {
    background: ${dark ? "#14141d" : "#ffffff"}; border: 1px solid var(--border2);
    border-radius: var(--r2); padding: 28px; width: 100%; max-width: 420px;
    box-shadow: 0 24px 70px rgba(0,0,0,${dark ? 0.6 : 0.18});
    animation: modal-in 0.22s cubic-bezier(0.2, 0.9, 0.3, 1.2) both;
  }
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
  @keyframes overlay-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes modal-in { from { opacity: 0; transform: translateY(12px) scale(0.97); } to { opacity: 1; transform: none; } }
  @keyframes shimmer { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }
  @keyframes tab-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
  @keyframes podium-rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }

  /* PODIUM — the top three get a real visual moment above the table rather
     than just a medal emoji in an ordinary row. Order is 2nd, 1st, 3rd so
     first place stands centre and tallest. */
  .podium { display: grid; grid-template-columns: 1fr 1.15fr 1fr; gap: 10px; align-items: end; margin-bottom: 22px; }
  .podium-slot { display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; animation: podium-rise 0.45s ease both; }
  .podium-slot:nth-child(1) { animation-delay: 0.06s; }
  .podium-slot:nth-child(2) { animation-delay: 0s; }
  .podium-slot:nth-child(3) { animation-delay: 0.12s; }
  .podium-medal { font-size: 22px; line-height: 1; }
  .podium-name { font-size: 12px; font-weight: 700; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .podium-name.you { color: var(--accent2); }
  .podium-pts { font-family: var(--font-display); font-size: 20px; letter-spacing: 0.5px; }
  .podium-block {
    width: 100%; border-radius: 12px 12px 0 0; border: 1px solid var(--border); border-bottom: none;
    display: flex; align-items: flex-start; justify-content: center; padding-top: 8px;
    font-size: 10px; font-weight: 800; letter-spacing: 1px; color: var(--muted);
  }
  .podium-block.gold   { height: 56px; background: linear-gradient(180deg, rgba(245,158,11,0.30), rgba(245,158,11,0.05)); border-color: rgba(245,158,11,0.4); }
  .podium-block.silver { height: 40px; background: linear-gradient(180deg, rgba(190,199,214,0.26), rgba(190,199,214,0.04)); }
  .podium-block.bronze { height: 30px; background: linear-gradient(180deg, rgba(205,127,50,0.26), rgba(205,127,50,0.04)); }

  /* SKELETONS — a shaped placeholder while data loads, instead of a blank
     panel that snaps into content. */
  .skeleton { border-radius: 8px; background: linear-gradient(90deg, var(--surface2) 25%, var(--surface3) 50%, var(--surface2) 75%); background-size: 800px 100%; animation: shimmer 1.4s linear infinite; }
  .skeleton-row { height: 44px; margin-bottom: 8px; border-radius: 12px; }
  .skeleton-title { height: 20px; width: 45%; margin-bottom: 16px; }

  /* Fade each tab's content in, so switching views feels intentional. */
  .tab-view { animation: tab-in 0.28s ease both; }

  /* Anyone who's asked their OS for less motion gets none of the above. */
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.001ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.001ms !important;
      scroll-behavior: auto !important;
    }
  }

  /* MOBILE — the app had zero responsive breakpoints until real phone
     testing surfaced actual overlap bugs (not just "could look nicer"):
     fixed-width standings columns didn't leave room for player names, and
     fixture cards let long team names collide with the score inputs. */
  @media (max-width: 560px) {
    /* Reclaim the page margins first — 28px of .main padding plus 22px of
       card padding was eating 100px of a 360px screen before a single column
       was drawn. */
    .main { padding: 16px 12px; padding-left: calc(12px + env(safe-area-inset-left, 0px)); padding-right: calc(12px + env(safe-area-inset-right, 0px)); }
    .card { padding: 16px 14px; }
    .header { padding-left: calc(16px + env(safe-area-inset-left, 0px)); padding-right: calc(16px + env(safe-area-inset-right, 0px)); }
    .nav { padding-left: calc(12px + env(safe-area-inset-left, 0px)); padding-right: calc(12px + env(safe-area-inset-right, 0px)); }
    .page-title { font-size: 26px; }

    /* Two numeric columns AND a readable name don't fit. The columns go; the
       same numbers reappear under the name via .standings-substats. */
    .standings-row { gap: 8px; padding: 10px 6px; }
    .standings-col-rank { width: 20px; font-size: 15px; }
    .standings-col-stat { display: none; }
    .standings-substats { display: block; }
    .standings-col-pts { width: 40px; }
    .standings-col-move { width: 14px; }
    .standings-col-player { gap: 8px; }
    .standings-head span { font-size: 8.5px; letter-spacing: 0.2px; }
    .standings-name { font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .standings-pts { font-size: 17px; }

    .fixture-body { flex-direction: column; align-items: stretch; }

    /* NFL standings: full team names need room next to a bar and a record. */
    .nfl-row { gap: 8px; padding: 8px 4px; }
    .nfl-row-bar { width: 40px; }
    .nfl-row-rec { width: 52px; font-size: 14px; }

    /* Countdown: four units at 66px wrapped awkwardly on narrow screens. */
    .countdown-unit { min-width: 0; flex: 1; padding: 10px 2px; }
    .countdown-unit b { font-size: 24px; }
    .countdown-clock { gap: 6px; }

    /* Podium and head-to-head both put names in narrow columns. */
    .podium { gap: 6px; }
    .podium-name { font-size: 11px; }
    .podium-pts { font-size: 17px; }
    .h2h-points { font-size: 26px; }
    .h2h-name { font-size: 11.5px; }
    .h2h-row-picks { grid-template-columns: 1fr; }

    .modal { padding: 20px 16px; }
    .admin-panel { font-size: 14px; }
  }
`;
