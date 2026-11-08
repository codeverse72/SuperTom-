import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMessage: '',
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error?.message || 'An unexpected error occurred' };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('SuperTom App ErrorBoundary caught:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, errorMessage: '' });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-3xl p-6 bg-gradient-to-b from-[#1c0828] to-[#0d0317] border border-rose-500/40 text-center space-y-4 my-8 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/20 border border-rose-500/50 flex items-center justify-center mx-auto text-rose-400">
            <AlertCircle className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-extrabold text-white font-display">
              {this.props.fallbackTitle || 'Component Reload Needed'}
            </h3>
            <p className="text-xs text-rose-200/80 font-mono">
              {this.state.errorMessage}
            </p>
          </div>
          <button
            type="button"
            onClick={this.handleReset}
            className="px-5 py-2.5 rounded-xl btn-gold-3d font-bold text-xs uppercase tracking-wide inline-flex items-center gap-2 cursor-pointer active:scale-95 text-purple-950"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reload Screen</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

