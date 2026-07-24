// Shown on every page (both the logged-out AuthPage and every authenticated
// tab in App.jsx) — not sticky/floating, just scrolls with the page content,
// since a fixed footer would eat into precious space on phones.
export default function Footer() {
  return (
    <footer className="app-footer">
      <div className="app-footer-creator">Creator: GUNMETAL JACK</div>
      <div className="app-footer-legal">
        ScoreClash is an independent, fan-made prediction game and is not affiliated with, endorsed by, or sponsored by
        the NFL or any of its teams. All NFL team names, logos, and related marks are trademarks of the National
        Football League and its respective member clubs.
      </div>
    </footer>
  );
}
