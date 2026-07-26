import { Component } from "react";
import { css } from "../theme.js";

// Without this, a single thrown error anywhere in the tree unmounts the whole
// app and leaves a blank white page — no message, no way back. For people who
// aren't going to open a browser console, that's indistinguishable from the
// site being broken forever.
//
// Has to be a class: error boundaries have no hooks equivalent in React.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Nothing to report to yet, but keep it in the console for debugging.
    console.error("ScoreClash crashed:", error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        {/* Styles live here rather than at the root: a crash can happen before
            App has rendered the theme, but rendering a second full stylesheet
            on every normal page load just to cover that was wasteful. */}
        <style>{css(true)}</style>
        <div className="glass card" style={{ maxWidth: 460, textAlign: "center" }}>
          <div className="empty-state">
            <div className="empty-state-icon">😵</div>
            <div className="empty-state-title">Something went wrong</div>
            <div className="empty-state-sub" style={{ marginBottom: 16 }}>
              ScoreClash hit an unexpected error. Reloading usually clears it — your picks are saved
              on the server, so nothing is lost.
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
              <button className="btn btn-primary" onClick={() => window.location.reload()}>Reload</button>
              <button className="btn btn-ghost" onClick={() => this.setState({ error: null })}>Try again</button>
            </div>
            <details style={{ marginTop: 16, textAlign: "left" }}>
              <summary style={{ cursor: "pointer", fontSize: 11.5, color: "var(--muted)" }}>Technical details</summary>
              <pre style={{ fontSize: 10.5, whiteSpace: "pre-wrap", marginTop: 8, opacity: 0.75 }}>
                {String(this.state.error?.message || this.state.error)}
              </pre>
            </details>
          </div>
        </div>
      </div>
    );
  }
}
