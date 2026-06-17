import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthState } from '@/hooks/useAuthState';
import { Skeleton } from '@/components/ui/skeleton';

interface AuthGuardProps {
  children: React.ReactNode;
  fallbackPath?: string;
  requireActive?: boolean;
  allowOnboarding?: boolean;
}

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-background">
    <div className="space-y-4 w-full max-w-md p-8">
      <Skeleton className="h-8 w-3/4 mx-auto" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-32 w-full" />
    </div>
  </div>
);

/**
 * AuthGuard protects routes that require authentication.
 * 
 * Props:
 * - fallbackPath: Where to redirect if not authenticated (default: /auth)
 * - requireActive: If true, redirects onboarding users to /onboarding/profile
 * - allowOnboarding: If true, allows users in onboarding state (for onboarding routes)
 */
export function AuthGuard({ 
  children, 
  fallbackPath = '/auth',
  requireActive = false,
  allowOnboarding = false,
}: AuthGuardProps) {
  const { loading, isAuthenticated, isOnboarding, profile } = useAuthState();
  const location = useLocation();

  if (loading) {
    return <PageLoader />;
  }

  // Not authenticated - redirect to auth. Carry the full URL (pathname +
  // search + hash) through `returnTo` so post-auth navigation lands the
  // user back where they were trying to go — most importantly preserving
  // ?invite=… deep links on /player/play, which otherwise get dropped on
  // the auth bounce and leave the player on the dashboard wondering why
  // their share link "didn't work". (Audit-flagged.)
  if (!isAuthenticated) {
    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    return (
      <Navigate
        to={fallbackPath}
        state={{ from: location, returnTo }}
        replace
      />
    );
  }

  // User is in onboarding and we require active state
  if (requireActive && isOnboarding && !allowOnboarding) {
    // Don't redirect if already on an onboarding route
    if (!location.pathname.startsWith('/onboarding')) {
      // Check if profile is incomplete vs just needs first match
      if (!profile?.full_name) {
        return <Navigate to="/onboarding/profile" replace />;
      }
      return <Navigate to="/onboarding/first-match" replace />;
    }
  }

  return <>{children}</>;
}
