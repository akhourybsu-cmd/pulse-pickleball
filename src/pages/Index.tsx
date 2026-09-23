import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { PublicHomepage } from '@/components/homepage/PublicHomepage';
import { Button } from '@/components/ui/button';
import { useAuthState } from '@/hooks/useAuthState';
import { consumePostAuthRedirect, peekPostAuthRedirect, DEFAULT_AUTH_DESTINATION } from '@/lib/authRedirect';

/** Share the bounded app-wide session check instead of starting another
 * unbounded getSession request every time the home route mounts. */
const Index = () => {
  const { loading, isAuthenticated, profile, sessionError, refresh } = useAuthState();
  // Read without consuming during render: StrictMode and rerenders must keep
  // the same destination until Navigate commits.
  const [destination] = useState(() => peekPostAuthRedirect() || DEFAULT_AUTH_DESTINATION);
  useEffect(() => { if (isAuthenticated && !sessionError) consumePostAuthRedirect(); }, [isAuthenticated, sessionError]);

  if (loading) return <div role="status" aria-label="Connecting to PULSE" className="min-h-screen flex items-center justify-center bg-background">
    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
  </div>;

  if (sessionError && !profile) return <div className="min-h-screen flex items-center justify-center p-6 bg-background">
    <div role="alert" className="max-w-sm text-center space-y-4">
      <h1 className="text-xl font-semibold">Connection interrupted</h1>
      <p className="text-sm text-muted-foreground">{sessionError}</p>
      <Button onClick={() => void refresh()}>Retry connection</Button>
      <Button variant="outline" onClick={() => window.location.reload()}>Reload PULSE</Button>
    </div>
  </div>;

  if (isAuthenticated) return <Navigate to={destination} replace />;
  return <PublicHomepage />;
};

export default Index;
