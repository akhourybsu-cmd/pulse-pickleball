import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useMode } from '@/contexts/ModeContext';
import { Skeleton } from '@/components/ui/skeleton';

type VenueActivationState = 'claimed' | 'pending' | 'active' | 'suspended';

interface VenueGuardProps {
  children: React.ReactNode;
  fallbackPath?: string;
  requireActivation?: VenueActivationState;
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
 * VenueGuard protects venue routes.
 * Ensures user has venue access and optionally checks activation state.
 * 
 * Props:
 * - fallbackPath: Where to redirect if no venue access (default: /player/dashboard)
 * - requireActivation: Minimum activation state required (claimed < pending < active)
 * - allowOnboarding: If true, allows venues in any state (for venue onboarding routes)
 */
export function VenueGuard({ 
  children, 
  fallbackPath = '/player/dashboard',
  requireActivation,
  allowOnboarding = false,
}: VenueGuardProps) {
  const { currentVenueId, venueAccess, isLoading, hasVenueAccess, currentVenue } = useMode();
  const location = useLocation();

  if (isLoading) {
    return <PageLoader />;
  }

  // No venue access at all - redirect to player dashboard
  if (!hasVenueAccess) {
    return <Navigate to={fallbackPath} replace />;
  }

  // No current venue selected - try to select one
  if (!currentVenueId && venueAccess.length > 0) {
    // Let ModeContext handle auto-selection
    return <PageLoader />;
  }

  // No current venue after auto-selection attempt
  if (!currentVenueId) {
    return <Navigate to={fallbackPath} replace />;
  }

  // Check activation state if required (and not allowing onboarding)
  if (requireActivation && !allowOnboarding && currentVenue) {
    const activationState = (currentVenue as any).activation_state as VenueActivationState | undefined;
    
    const stateOrder: VenueActivationState[] = ['claimed', 'pending', 'active', 'suspended'];
    const requiredIndex = stateOrder.indexOf(requireActivation);
    const currentIndex = activationState ? stateOrder.indexOf(activationState) : 0;

    // If current state is less than required, redirect to onboarding
    if (currentIndex < requiredIndex) {
      // Don't redirect if already on a venue onboarding route
      if (!location.pathname.startsWith('/venue/onboarding')) {
        if (!activationState || activationState === 'claimed') {
          return <Navigate to="/venue/onboarding/profile" replace />;
        }
        if (activationState === 'pending') {
          return <Navigate to="/venue/onboarding/first-event" replace />;
        }
      }
    }
  }

  return <>{children}</>;
}
