import React from 'react';

type AppErrorBoundaryState = {
  hasError: boolean;
  message: string;
};

export default class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  AppErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: unknown): AppErrorBoundaryState {
    const message = error instanceof Error ? error.message : 'Runtime error';
    return { hasError: true, message };
  }

  componentDidCatch(error: unknown, info: unknown) {
    // Keep logs in browser console for debugging.
    console.error('AppErrorBoundary caught:', error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="max-w-xl w-full bg-white border border-slate-200 rounded-2xl p-6 shadow-xl">
            <p className="text-xs font-black uppercase tracking-widest text-rose-600">Application Error</p>
            <h1 className="mt-2 text-2xl font-black text-slate-900">Page gagal dirender</h1>
            <p className="mt-3 text-sm text-slate-600">
              Error: {this.state.message || 'Unknown error'}
            </p>
            <div className="mt-5 flex items-center gap-3">
              <button
                onClick={this.handleReload}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-black uppercase tracking-wider"
              >
                Reload
              </button>
              <a
                href="/dashboard"
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-sm font-black uppercase tracking-wider"
              >
                Back to Dashboard
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
