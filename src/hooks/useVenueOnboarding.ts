import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useMode } from "@/contexts/ModeContext";

export type VenueOnboardingStep = 
  | 'welcome' 
  | 'profile' 
  | 'first-event' 
  | 'share' 
  | 'complete' 
  | 'done';

interface VenueOnboardingState {
  step: VenueOnboardingStep;
  isNewVenue: boolean;
  hasCompletedProfile: boolean;
  hasFirstEvent: boolean;
  isLoading: boolean;
  venueId: string | null;
  venueName: string | null;
  venueSlug: string | null;
}

interface UseVenueOnboardingReturn extends VenueOnboardingState {
  showWelcome: boolean;
  setShowWelcome: (show: boolean) => void;
  advanceStep: () => void;
  skipToStep: (step: VenueOnboardingStep) => void;
  skipOnboarding: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
  refreshState: () => Promise<void>;
  updateVenueProfile: (data: { tagline?: string; description?: string; logo_url?: string }) => Promise<boolean>;
}

export const useVenueOnboarding = (): UseVenueOnboardingReturn => {
  const navigate = useNavigate();
  const { currentVenueId, currentVenue } = useMode();
  const [showWelcome, setShowWelcome] = useState(false);
  const [state, setState] = useState<VenueOnboardingState>({
    step: 'welcome',
    isNewVenue: false,
    hasCompletedProfile: false,
    hasFirstEvent: false,
    isLoading: true,
    venueId: null,
    venueName: null,
    venueSlug: null,
  });

  const checkOnboardingStatus = useCallback(async () => {
    if (!currentVenueId) {
      setState(prev => ({ ...prev, isLoading: false }));
      return;
    }

    try {
      // Fetch venue data including onboarding status
      const { data: venue } = await supabase
        .from('venues')
        .select('id, name, slug, tagline, description, logo_url, onboarding_completed, onboarding_step')
        .eq('id', currentVenueId)
        .single();

      if (!venue) {
        setState(prev => ({ ...prev, isLoading: false, venueId: currentVenueId }));
        return;
      }

      // Check if venue has events
      const { count: eventCount } = await supabase
        .from('venue_events')
        .select('*', { count: 'exact', head: true })
        .eq('venue_id', currentVenueId);

      const hasCompletedProfile = !!(venue.tagline || venue.description);
      const hasFirstEvent = (eventCount || 0) > 0;
      const isNewVenue = !venue.onboarding_completed;

      // Determine current step based on progress
      let step: VenueOnboardingStep = 'done';
      if (!venue.onboarding_completed) {
        if (!hasCompletedProfile) {
          step = 'profile';
        } else if (!hasFirstEvent) {
          step = 'first-event';
        } else {
          step = 'share';
        }
      }

      setState({
        step,
        isNewVenue,
        hasCompletedProfile,
        hasFirstEvent,
        isLoading: false,
        venueId: venue.id,
        venueName: venue.name,
        venueSlug: venue.slug,
      });

      // Show welcome modal for new venues
      if (isNewVenue && !hasCompletedProfile && !hasFirstEvent) {
        setShowWelcome(true);
      }
    } catch (error) {
      console.error('Error checking venue onboarding status:', error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [currentVenueId]);

  useEffect(() => {
    checkOnboardingStatus();
  }, [checkOnboardingStatus]);

  const advanceStep = useCallback(() => {
    const stepOrder: VenueOnboardingStep[] = ['welcome', 'profile', 'first-event', 'share', 'complete', 'done'];
    const currentIndex = stepOrder.indexOf(state.step);
    
    if (currentIndex < stepOrder.length - 1) {
      const nextStep = stepOrder[currentIndex + 1];
      setState(prev => ({ ...prev, step: nextStep }));
      
      // Navigate to appropriate route
      switch (nextStep) {
        case 'profile':
          navigate('/venue/onboarding/profile');
          break;
        case 'first-event':
          navigate('/venue/onboarding/first-event');
          break;
        case 'share':
          navigate('/venue/onboarding/share');
          break;
        case 'complete':
          navigate('/venue/onboarding/complete');
          break;
        case 'done':
          navigate('/venue');
          break;
      }
    }
  }, [state.step, navigate]);

  const skipToStep = useCallback((step: VenueOnboardingStep) => {
    setState(prev => ({ ...prev, step }));
    
    switch (step) {
      case 'profile':
        navigate('/venue/onboarding/profile');
        break;
      case 'first-event':
        navigate('/venue/onboarding/first-event');
        break;
      case 'share':
        navigate('/venue/onboarding/share');
        break;
      case 'complete':
        navigate('/venue/onboarding/complete');
        break;
      case 'done':
        navigate('/venue');
        break;
    }
  }, [navigate]);

  const skipOnboarding = useCallback(async () => {
    if (!state.venueId) return;

    try {
      await supabase
        .from('venues')
        .update({ onboarding_completed: true })
        .eq('id', state.venueId);

      setState(prev => ({ ...prev, step: 'done', isNewVenue: false }));
      setShowWelcome(false);
      navigate('/venue');
    } catch (error) {
      console.error('Error skipping venue onboarding:', error);
    }
  }, [state.venueId, navigate]);

  const completeOnboarding = useCallback(async () => {
    if (!state.venueId) return;

    try {
      await supabase
        .from('venues')
        .update({ onboarding_completed: true })
        .eq('id', state.venueId);

      setState(prev => ({ ...prev, step: 'done', isNewVenue: false }));
      navigate('/venue');
    } catch (error) {
      console.error('Error completing venue onboarding:', error);
    }
  }, [state.venueId, navigate]);

  const refreshState = useCallback(async () => {
    await checkOnboardingStatus();
  }, [checkOnboardingStatus]);

  const updateVenueProfile = useCallback(async (data: { tagline?: string; description?: string; logo_url?: string }): Promise<boolean> => {
    if (!state.venueId) return false;

    try {
      const { error } = await supabase
        .from('venues')
        .update(data)
        .eq('id', state.venueId);

      if (error) throw error;
      
      await refreshState();
      return true;
    } catch (error) {
      console.error('Error updating venue profile:', error);
      return false;
    }
  }, [state.venueId, refreshState]);

  return {
    ...state,
    showWelcome,
    setShowWelcome,
    advanceStep,
    skipToStep,
    skipOnboarding,
    completeOnboarding,
    refreshState,
    updateVenueProfile,
  };
};
