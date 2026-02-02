import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export type OnboardingStep = 
  | 'welcome' 
  | 'profile' 
  | 'first-match' 
  | 'rating' 
  | 'complete' 
  | 'done';

interface OnboardingState {
  step: OnboardingStep;
  isNewUser: boolean;
  hasCompletedProfile: boolean;
  hasFirstMatch: boolean;
  isLoading: boolean;
  userId: string | null;
  currentRating: number;
  ratingChange: number;
}

interface UseOnboardingReturn extends OnboardingState {
  showWelcome: boolean;
  setShowWelcome: (show: boolean) => void;
  advanceStep: () => void;
  skipToStep: (step: OnboardingStep) => void;
  skipOnboarding: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
  refreshState: () => Promise<void>;
}

export const useOnboarding = (): UseOnboardingReturn => {
  const navigate = useNavigate();
  const [showWelcome, setShowWelcome] = useState(false);
  const [state, setState] = useState<OnboardingState>({
    step: 'welcome',
    isNewUser: false,
    hasCompletedProfile: false,
    hasFirstMatch: false,
    isLoading: true,
    userId: null,
    currentRating: 3.0,
    ratingChange: 0,
  });

  const checkOnboardingStatus = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setState(prev => ({ ...prev, isLoading: false }));
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('tutorial_completed, display_name, first_name, avatar_url, town, state, total_matches, current_rating, week_start_rating')
        .eq('id', user.id)
        .single();

      if (!profile) {
        setState(prev => ({ ...prev, isLoading: false, userId: user.id }));
        return;
      }

      const hasCompletedProfile = !!(
        (profile.display_name || profile.first_name)
      );
      
      const hasFirstMatch = (profile.total_matches || 0) > 0;
      const isNewUser = !profile.tutorial_completed;
      const ratingChange = (profile.current_rating || 3.0) - (profile.week_start_rating || 3.0);

      // Determine current step based on progress
      let step: OnboardingStep = 'done';
      if (!profile.tutorial_completed) {
        if (!hasCompletedProfile) {
          step = 'profile';
        } else if (!hasFirstMatch) {
          step = 'first-match';
        } else {
          step = 'rating';
        }
      }

      setState({
        step,
        isNewUser,
        hasCompletedProfile,
        hasFirstMatch,
        isLoading: false,
        userId: user.id,
        currentRating: profile.current_rating || 3.0,
        ratingChange,
      });

      // Show welcome modal for new users who haven't started onboarding
      if (isNewUser && !hasCompletedProfile && !hasFirstMatch) {
        setShowWelcome(true);
      }
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  useEffect(() => {
    checkOnboardingStatus();
  }, [checkOnboardingStatus]);

  const advanceStep = useCallback(() => {
    const stepOrder: OnboardingStep[] = ['welcome', 'profile', 'first-match', 'rating', 'complete', 'done'];
    const currentIndex = stepOrder.indexOf(state.step);
    
    if (currentIndex < stepOrder.length - 1) {
      const nextStep = stepOrder[currentIndex + 1];
      setState(prev => ({ ...prev, step: nextStep }));
      
      // Navigate to appropriate route
      switch (nextStep) {
        case 'profile':
          navigate('/onboarding/profile');
          break;
        case 'first-match':
          navigate('/onboarding/first-match');
          break;
        case 'rating':
          navigate('/onboarding/rating');
          break;
        case 'complete':
          navigate('/onboarding/complete');
          break;
        case 'done':
          navigate('/player/dashboard');
          break;
      }
    }
  }, [state.step, navigate]);

  const skipToStep = useCallback((step: OnboardingStep) => {
    setState(prev => ({ ...prev, step }));
    
    switch (step) {
      case 'profile':
        navigate('/onboarding/profile');
        break;
      case 'first-match':
        navigate('/onboarding/first-match');
        break;
      case 'rating':
        navigate('/onboarding/rating');
        break;
      case 'complete':
        navigate('/onboarding/complete');
        break;
      case 'done':
        navigate('/player/dashboard');
        break;
    }
  }, [navigate]);

  const skipOnboarding = useCallback(async () => {
    if (!state.userId) return;

    try {
      await supabase
        .from('profiles')
        .update({ tutorial_completed: true })
        .eq('id', state.userId);

      setState(prev => ({ ...prev, step: 'done', isNewUser: false }));
      setShowWelcome(false);
      navigate('/player/dashboard');
    } catch (error) {
      console.error('Error skipping onboarding:', error);
    }
  }, [state.userId, navigate]);

  const completeOnboarding = useCallback(async () => {
    if (!state.userId) return;

    try {
      await supabase
        .from('profiles')
        .update({ tutorial_completed: true })
        .eq('id', state.userId);

      setState(prev => ({ ...prev, step: 'done', isNewUser: false }));
      navigate('/player/dashboard');
    } catch (error) {
      console.error('Error completing onboarding:', error);
    }
  }, [state.userId, navigate]);

  const refreshState = useCallback(async () => {
    await checkOnboardingStatus();
  }, [checkOnboardingStatus]);

  return {
    ...state,
    showWelcome,
    setShowWelcome,
    advanceStep,
    skipToStep,
    skipOnboarding,
    completeOnboarding,
    refreshState,
  };
};
