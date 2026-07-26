import React, { Component, ReactNode, ErrorInfo } from 'react';

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

export class AppErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
  };

  constructor(props: Props) {
    super(props);
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('React component error:', error, errorInfo.componentStack);
  }

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
    });
    window.location.assign('/');
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const message =
      this.state.error?.message ||
      'An unexpected rendering error occurred.';

    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-xl rounded-3xl border border-red-200 bg-white p-6 shadow-2xl">
          <h1 className="text-2xl font-black text-red-800">
            Something went wrong
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            The application encountered an error, but your browser is still working.
          </p>

          <pre className="mt-4 max-h-48 overflow-auto whitespace-pre-wrap rounded-2xl bg-red-50 p-4 text-xs text-red-800">
            {message}
          </pre>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white"
            >
              Reload
            </button>

            <button
              type="button"
              onClick={this.handleReset}
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700"
            >
              Go to Home
            </button>
          </div>
        </div>
      </div>
    );
  }
}
