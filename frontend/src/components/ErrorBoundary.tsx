import { Component, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { logError, reportClientError } from '@/lib/logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onGoHome?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  reportStatus: 'idle' | 'pending' | 'sent' | 'failed';
}

class ErrorBoundaryFrame extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      reportStatus: 'idle',
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logError('Error caught by ErrorBoundary:', { error, errorInfo });

    if (import.meta.env.PROD) {
      this.setState({ errorInfo, reportStatus: 'pending' });
      void reportClientError(error, errorInfo).then((reported) => {
        if (this.state.hasError) {
          this.setState({ reportStatus: reported ? 'sent' : 'failed' });
        }
      });
      return;
    }

    this.setState({ errorInfo });
  }

  handleGoHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, reportStatus: 'idle' });
    this.props.onGoHome?.();
  };

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, reportStatus: 'idle' });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
          <div className="max-w-md w-full bg-card rounded-lg shadow-lg p-8 text-center">
            {/* Error Icon */}
            <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-6">
              <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
            </div>

            {/* Error Title */}
            <h1 className="text-2xl font-bold text-foreground mb-2">Something went wrong</h1>

            {/* Error Description */}
            <p className="text-muted-foreground mb-6">
              We're sorry, but something unexpected happened. Try again or go back to your
              dashboard.
            </p>

            {this.state.reportStatus === 'pending' && (
              <p className="text-sm text-muted-foreground mb-6">
                Sending a diagnostic report to support...
              </p>
            )}
            {this.state.reportStatus === 'sent' && (
              <p className="text-sm text-muted-foreground mb-6">
                A diagnostic report has been sent to support.
              </p>
            )}
            {this.state.reportStatus === 'failed' && (
              <p className="text-sm text-muted-foreground mb-6">
                We could not send a diagnostic report automatically. Contact support if the problem
                persists.
              </p>
            )}

            {/* Error Details (Development only) */}
            {import.meta.env.DEV && this.state.error && (
              <div className="mb-6 p-4 bg-muted rounded-lg text-left">
                <p className="text-xs font-mono text-red-600 dark:text-red-400 break-all">
                  {this.state.error.toString()}
                </p>
                {this.state.errorInfo && (
                  <details className="mt-2">
                    <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                      Show component stack
                    </summary>
                    <pre className="mt-2 text-xs font-mono text-muted-foreground overflow-auto max-h-40">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </div>
            )}

            {/* Recovery Actions */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={this.handleRetry}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Try Again
              </button>
              <button
                onClick={this.handleGoHome}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-border text-foreground rounded-lg hover:bg-muted/50 transition-colors"
              >
                <Home className="h-4 w-4" />
                Go to Dashboard
              </button>
            </div>

            {/* Support Link */}
            <p className="mt-6 text-sm text-muted-foreground">
              If this problem persists, please{' '}
              <a href="/support" className="text-primary hover:underline">
                contact support
              </a>
              .
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Higher-order component to wrap a component with an error boundary
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  fallback?: ReactNode,
) {
  return function WithErrorBoundary(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    );
  };
}

export function ErrorBoundary({ children, fallback }: Omit<Props, 'onGoHome'>) {
  const navigate = useNavigate();

  return (
    <ErrorBoundaryFrame
      fallback={fallback}
      onGoHome={() => navigate('/dashboard', { replace: true })}
    >
      {children}
    </ErrorBoundaryFrame>
  );
}

export default ErrorBoundary;
