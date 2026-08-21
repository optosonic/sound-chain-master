import React from 'react';

/**
 * Catches a render crash in one view mode (Mini / Medium / Large / Full) and
 * shows the actual error instead of a blank white screen, so a throw in a
 * single layout never blanks the whole app and the cause stays visible.
 */
export default class ViewErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('[ViewErrorBoundary]', this.props.label, error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      const e = this.state.error;
      return (
        <div className="min-h-screen w-full p-6 font-mono text-sm text-rose-200">
          <div className="mx-auto max-w-2xl rounded-lg border border-rose-500/40 bg-rose-950/40 p-5">
            <div className="mb-2 text-[11px] uppercase tracking-widest text-rose-400">
              {this.props.label || 'View'} — render crash
            </div>
            <div className="mb-3 text-base font-semibold text-white">
              {e?.message || String(e)}
            </div>
            {e?.stack && (
              <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap text-[11px] leading-relaxed text-rose-200/80">
                {e.stack}
              </pre>
            )}
            <button
              onClick={this.reset}
              className="mt-4 rounded-md border border-rose-400/50 bg-rose-500/20 px-3 py-1.5 text-[11px] font-semibold text-rose-100 hover:bg-rose-500/30"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}