// ─── LOGO ───────────────────────────────────────────────────────────────────
// Hexagon badge (sport-neutral — no soccer ball, no single-sport football,
// so this doesn't need re-branding again if more sports get added later)
// with the same neon blue/red glow language as the original app's icon.

export function HexIcon({ size = 36, style = {} }) {
  return (
    <svg viewBox="0 0 80 80" width={size} height={size} style={{ display: "block", ...style }}>
      <defs>
        <filter id="hx-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="2.5" result="b1" />
          <feGaussianBlur stdDeviation="6" result="b2" />
          <feMerge><feMergeNode in="b2" /><feMergeNode in="b1" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <linearGradient id="hx-blue" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#06d6f7" />
        </linearGradient>
      </defs>
      <polygon points="40,6 70,23 70,57 40,74 10,57 10,23" fill="#0d0d16" stroke="url(#hx-blue)" strokeWidth="2.5" filter="url(#hx-glow)" />
      <polygon points="40,20 58,30 58,50 40,60 22,50 22,30" fill="none" stroke="url(#hx-blue)" strokeWidth="1" opacity="0.35" />
      <path d="M44 16 L32 40 L40 40 L28 64 L52 36 L43 36 Z" fill="url(#hx-blue)" filter="url(#hx-glow)" />
    </svg>
  );
}

export function WordmarkLogo({ name = "SCORECLASH", width = 420 }) {
  // Splits on the last uppercase-run boundary purely for two-tone styling —
  // swap `name` for whatever the final product name ends up being.
  const mid = Math.ceil(name.length / 2);
  const first = name.slice(0, mid), second = name.slice(mid);
  return (
    <svg viewBox="0 0 780 200" width={width} style={{ display: "block" }}>
      <defs>
        <linearGradient id="wm-blue" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#3b82f6" /><stop offset="100%" stopColor="#06d6f7" />
        </linearGradient>
        <linearGradient id="wm-red" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#f43f5e" /><stop offset="100%" stopColor="#fb923c" />
        </linearGradient>
        <filter id="wm-soft" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <text x="0" y="90" fontFamily="'Anton','Arial Black',Impact,sans-serif" fontSize="80" letterSpacing="4" fill="url(#wm-blue)" filter="url(#wm-soft)">{first}</text>
      <text x="0" y="166" fontFamily="'Anton','Arial Black',Impact,sans-serif" fontSize="80" letterSpacing="4" fill="url(#wm-red)" filter="url(#wm-soft)">{second}</text>
      <text x="4" y="192" fontFamily="'Inter',sans-serif" fontSize="13" letterSpacing="3" fill="#8890ab">PREDICT. COMPETE. WIN BRAGGING RIGHTS.</text>
    </svg>
  );
}

// Animated boot sequence shown instead of a static loading bar: the hex ring
// draws itself in, the lightning bolt strikes/flashes, the wordmark snaps in
// from both sides, slogan fades up, then a slim pulse holds while data loads.
export function LogoIntro({ name = "SCORECLASH" }) {
  const mid = Math.ceil(name.length / 2);
  const first = name.slice(0, mid), second = name.slice(mid);
  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", background: "#07070b", gap: 18, position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse at 30% 40%, rgba(59,130,246,0.10) 0%, transparent 55%), radial-gradient(ellipse at 70% 65%, rgba(244,63,94,0.08) 0%, transparent 50%)",
      }} />
      <svg viewBox="0 0 160 160" width="120" height="120" style={{ overflow: "visible", position: "relative", zIndex: 1 }}>
        <defs>
          <filter id="li-soft" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="li-strong" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="6" result="b1" /><feGaussianBlur stdDeviation="14" result="b2" />
            <feMerge><feMergeNode in="b2" /><feMergeNode in="b1" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <linearGradient id="li-blue" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3b82f6" /><stop offset="100%" stopColor="#06d6f7" />
          </linearGradient>
        </defs>
        <polygon points="80,20 136,50 136,110 80,140 24,110 24,50" fill="none" stroke="url(#li-blue)" strokeWidth="3"
          strokeDasharray="360" strokeDashoffset="360" strokeLinejoin="round" filter="url(#li-soft)"
          style={{ animation: "draw-ring 1.1s cubic-bezier(.4,0,.2,1) forwards" }} />
        <path d="M88 46 L64 84 L80 84 L58 122 L104 78 L84 78 Z" fill="url(#li-blue)" filter="url(#li-strong)"
          opacity="0" style={{ animation: "bolt-strike 0.5s cubic-bezier(.2,.8,.3,1.4) 1.05s forwards" }} />
      </svg>
      <div style={{ display: "flex", fontFamily: "'Anton','Arial Black',Impact,sans-serif", fontSize: 42, letterSpacing: 2, position: "relative", zIndex: 1 }}>
        <span style={{ color: "#3b82f6", opacity: 0, transform: "translateX(-40px)", display: "inline-block", animation: "slide-in-left 0.5s cubic-bezier(.2,.8,.2,1) 1.5s forwards" }}>{first}</span>
        <span style={{ color: "#f43f5e", opacity: 0, transform: "translateX(40px)", display: "inline-block", animation: "slide-in-right 0.5s cubic-bezier(.2,.8,.2,1) 1.55s forwards" }}>{second}</span>
      </div>
      <div style={{ fontSize: 11, letterSpacing: 3, color: "#8890ab", opacity: 0, animation: "fade-up 0.5s ease 2.05s forwards", position: "relative", zIndex: 1 }}>
        PREDICT.&nbsp;COMPETE.&nbsp;WIN&nbsp;BRAGGING&nbsp;RIGHTS.
      </div>
      <div style={{ width: 150, height: 2, background: "#22222f", borderRadius: 2, overflow: "hidden", marginTop: 6, opacity: 0, animation: "fade-up 0.4s ease 2.3s forwards", position: "relative", zIndex: 1 }}>
        <div style={{ height: "100%", background: "linear-gradient(90deg,#3b82f6,#06d6f7)", animation: "pulse-bar 1.4s ease-in-out infinite 2.3s" }} />
      </div>
    </div>
  );
}
