import { Component } from "react";
import type { ReactNode } from "react";

interface State {
  error: Error | null;
}

/**
 * Keeps one view's failure (a map chunk that did not load, no WebGL, a bug) from blanking the whole app.
 */
export default class ErrorBoundary extends Component<{ children: ReactNode; /** Fill the whole page, for use around the entire app. */ page?: boolean }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const card = (
      <div className="boundary glass" role="alert">
        <strong>This view didn't load</strong>
        <span>Reloading usually fixes it.</span>
        <code>{error.message}</code>
        <div className="boundary-actions">
          <button className="pill-btn primary" onClick={() => window.location.reload()}>
            Reload
          </button>
          <button
            className="pill-btn"
            onClick={() => {
              window.location.hash = "/";
              this.setState({ error: null });
            }}
          >
            Back to the relationship map
          </button>
        </div>
      </div>
    );
    if (!this.props.page) return card;
    return (
      <div className="app">
        <div className="backdrop" aria-hidden="true" />
        <div className="gate">{card}</div>
      </div>
    );
  }
}
