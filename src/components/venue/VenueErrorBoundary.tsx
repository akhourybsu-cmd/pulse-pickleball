import { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary for venue pages.
 * Catches rendering errors and provides graceful recovery options.
 * 
 * Common errors this handles:
 * - Missing venue data (RLS policy violations)
 * - Network errors during data fetch
 * - Component rendering failures
 */
export class VenueErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('VenueErrorBoundary caught error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleGoHome = () => {
    window.location.href = '/venue';
  };

  render() {
    if (this.state.hasError) {
      const isRLSError = this.state.error?.message?.includes('row-level security') ||
                         this.state.error?.message?.includes('permission denied');
      
      const isNetworkError = this.state.error?.message?.includes('fetch') ||
                             this.state.error?.message?.includes('network');

      return (
        <div className="p-6 flex items-center justify-center min-h-[400px]">
          <Card className="max-w-md w-full">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <CardTitle>{this.props.fallbackTitle || 'Something went wrong'}</CardTitle>
              <CardDescription>
                {isRLSError && 'You may not have permission to access this data.'}
                {isNetworkError && 'Unable to connect. Please check your connection.'}
                {!isRLSError && !isNetworkError && 'An unexpected error occurred while loading this page.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Button onClick={this.handleRetry} className="w-full">
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
              <Button variant="outline" onClick={this.handleGoHome} className="w-full">
                <Home className="h-4 w-4 mr-2" />
                Go to Overview
              </Button>
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="mt-4 text-xs text-muted-foreground">
                  <summary className="cursor-pointer">Technical Details</summary>
                  <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
                    {this.state.error.message}
                  </pre>
                </details>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
