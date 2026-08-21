import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ErrorPage } from '../../pages/ErrorPage';

interface Props {
  children: ReactNode;
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
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught React runtime error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      const errorDetails = `${this.state.error?.toString() || 'Unknown Error'}\n\nComponent Stack:\n${
        this.state.errorInfo?.componentStack || 'No stack trace available'
      }`;

      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 text-slate-100">
          <ErrorPage
            code="500"
            title="Terjadi Kesalahan Sistem (Runtime Error)"
            description="Antarmuka aplikasi mengalami kendala saat memproses tampilan. Silakan muat ulang halaman."
            details={errorDetails}
            onRetry={this.handleReset}
            onNavigateHome={() => {
              window.location.href = '/dashboard';
            }}
          />
        </div>
      );
    }

    return this.props.children;
  }
}
