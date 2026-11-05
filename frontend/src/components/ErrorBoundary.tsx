import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertOctagon, RefreshCw, Home, Trash2 } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Skill Leveling ErrorBoundary caught an unhandled exception:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  private handleResetState = () => {
    try {
      localStorage.removeItem('skill_leveling_hunter_stats');
      sessionStorage.clear();
    } catch {
      // ignore
    }
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-3xl border border-purple-800/80 bg-[#0d071a] p-8 shadow-[0_0_50px_rgba(147,51,234,0.3)]">
            {/* Skill Leveling System Alert Icon */}
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-950/80 border border-purple-700 text-purple-400 mx-auto mb-6 shadow-[0_0_20px_rgba(147,51,234,0.5)]">
              <AlertOctagon className="h-8 w-8 text-rose-500 animate-pulse" />
            </div>

            <div className="text-center">
              <span className="inline-block rounded-full bg-rose-950/80 border border-rose-800/70 px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-rose-300 mb-2">
                [SYSTEM MALFUNCTION DETECTED]
              </span>
              <h2 className="font-mono text-2xl font-black uppercase tracking-tight text-white">
                Hunter Interface Anomaly
              </h2>
              <p className="mt-2 text-sm text-purple-200/70 leading-relaxed">
                The System encountered an unexpected disruption in this dungeon sector. Your hunter profile and raid progress remain secured.
              </p>
            </div>

            {/* Error detail */}
            {this.state.error && (
              <div className="mt-6 rounded-xl bg-black/60 border border-purple-900/60 p-4 font-mono text-xs text-rose-300/90 overflow-x-auto max-h-32">
                <span className="text-purple-400 font-bold block mb-1">Fault Description:</span>
                {this.state.error.message || 'Unknown runtime anomaly'}
              </div>
            )}

            {/* Actions */}
            <div className="mt-8 space-y-3">
              <button
                onClick={this.handleReload}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-700 via-indigo-600 to-fuchsia-600 px-4 py-3 text-sm font-bold text-white shadow-[0_0_20px_rgba(147,51,234,0.4)] hover:from-purple-600 hover:to-indigo-500 transition"
              >
                <RefreshCw className="h-4 w-4" />
                Re-Awaken Interface
              </button>

              <button
                onClick={this.handleGoHome}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-purple-800/70 bg-purple-950/40 px-4 py-3 text-sm font-semibold text-purple-300 hover:bg-purple-900/40 transition"
              >
                <Home className="h-4 w-4" />
                Return to Hunters Association
              </button>

              <button
                onClick={this.handleResetState}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-zinc-800 px-4 py-2 text-xs font-mono text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition"
                title="Clears local hunter cache and returns to root"
              >
                <Trash2 className="h-3.5 w-3.5 text-zinc-500" />
                Clear Local State Cache
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

