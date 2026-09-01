import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { portfolio } from '../../config/portfolio';

interface Props {
  children: React.ReactNode;
  /** Rendered instead of the generic screen, used for the WebGL fallback. */
  fallback?: React.ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches render errors anywhere in the tree. A WebGL failure inside a
 * useFrame loop would otherwise blank the entire page with no explanation,
 * which is the worst possible outcome for a portfolio.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Kept visible in the console so the owner can debug a live site.
    console.error('[portfolio] render error', error, info.componentStack);
  }

  private reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-void-950 p-6">
        <div className="glass-strong clip-cyber w-full max-w-lg p-8 text-center">
          <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-neon-amber" />
          <h1 className="font-display text-2xl font-black text-neon-amber">SYSTEM FAULT</h1>
          <p className="mt-3 text-sm text-slate-300">
            The 3D engine hit an unexpected error. Your browser or GPU may not support some of the
            effects used here.
          </p>
          <p className="mt-2 font-mono text-[11px] text-slate-500" data-selectable>
            {this.state.error.message}
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              onClick={this.reset}
              className="clip-tag inline-flex items-center justify-center gap-2 bg-neon-cyan px-5 py-3 font-display text-sm font-black text-void-950 transition hover:brightness-110"
            >
              <RotateCcw className="h-4 w-4" /> RETRY
            </button>
            <a
              href={`mailto:${portfolio.links.email}`}
              className="clip-tag inline-flex items-center justify-center gap-2 border border-white/20 px-5 py-3 font-display text-sm font-bold text-slate-200 transition hover:border-neon-cyan hover:text-neon-cyan"
            >
              CONTACT {portfolio.identity.name.split(' ')[0].toUpperCase()}
            </a>
          </div>
        </div>
      </div>
    );
  }
}
