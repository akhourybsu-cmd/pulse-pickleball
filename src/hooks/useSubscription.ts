/**
 * Hook for managing venue subscriptions and feature access
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  SubscriptionTier, 
  VenueSubscription, 
  FeatureEntitlement,
  FEATURE_KEYS,
  FeatureKey 
} from "@/lib/monetization";

interface UseSubscriptionOptions {
  venueId: string | null;
}

interface UseSubscriptionResult {
  subscription: VenueSubscription | null;
  tier: SubscriptionTier;
  entitlements: FeatureEntitlement[];
  isLoading: boolean;
  error: Error | null;
  // Feature checks
  isFeatureEnabled: (featureKey: FeatureKey) => boolean;
  getFeatureLimit: (featureKey: FeatureKey) => number | null;
  canPerformAction: (featureKey: FeatureKey, currentCount: number) => {
    allowed: boolean;
    limit: number | null;
    upgradeRequired: boolean;
  };
  // Tier checks
  isFree: boolean;
  isPlus: boolean;
  isPro: boolean;
  isEnterprise: boolean;
  isPaid: boolean;
}

export function useSubscription({ venueId }: UseSubscriptionOptions): UseSubscriptionResult {
  // Fetch subscription
  const { 
    data: subscription, 
    isLoading: subLoading,
    error: subError 
  } = useQuery({
    queryKey: ['venue-subscription', venueId],
    queryFn: async () => {
      if (!venueId) return null;
      
      const { data, error } = await supabase
        .from('venue_subscriptions')
        .select('*')
        .eq('venue_id', venueId)
        .single();

      if (error) {
        // If no subscription exists, return null (will default to free)
        if (error.code === 'PGRST116') return null;
        throw error;
      }

      return data as VenueSubscription;
    },
    enabled: !!venueId,
  });

  const tier: SubscriptionTier = (subscription?.tier as SubscriptionTier) || 'free';

  // Fetch entitlements for current tier
  const { 
    data: entitlements = [],
    isLoading: entLoading 
  } = useQuery({
    queryKey: ['feature-entitlements', tier],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('feature_entitlements')
        .select('feature_key, limit_value, enabled')
        .eq('tier', tier);

      if (error) throw error;
      return data as FeatureEntitlement[];
    },
  });

  // Helper functions
  const isFeatureEnabled = (featureKey: FeatureKey): boolean => {
    const entitlement = entitlements.find(e => e.feature_key === featureKey);
    return entitlement?.enabled ?? false;
  };

  const getFeatureLimit = (featureKey: FeatureKey): number | null => {
    const entitlement = entitlements.find(e => e.feature_key === featureKey);
    if (!entitlement?.enabled) return 0;
    return entitlement.limit_value;
  };

  const canPerformAction = (featureKey: FeatureKey, currentCount: number) => {
    const limit = getFeatureLimit(featureKey);
    
    // null limit means unlimited
    if (limit === null) {
      return { allowed: true, limit: null, upgradeRequired: false };
    }

    const allowed = currentCount < limit;
    return {
      allowed,
      limit,
      upgradeRequired: !allowed,
    };
  };

  return {
    subscription,
    tier,
    entitlements,
    isLoading: subLoading || entLoading,
    error: subError as Error | null,
    // Feature checks
    isFeatureEnabled,
    getFeatureLimit,
    canPerformAction,
    // Tier checks
    isFree: tier === 'free',
    isPlus: tier === 'plus',
    isPro: tier === 'pro',
    isEnterprise: tier === 'enterprise',
    isPaid: tier !== 'free',
  };
}

/**
 * Hook for checking a single feature
 */
export function useFeatureAccess(venueId: string | null, featureKey: FeatureKey) {
  const { isFeatureEnabled, getFeatureLimit, isLoading } = useSubscription({ venueId });

  return {
    isEnabled: isFeatureEnabled(featureKey),
    limit: getFeatureLimit(featureKey),
    isLoading,
  };
}

/**
 * Hook for checking if venue can create more of something
 */
export function useFeatureLimit(
  venueId: string | null, 
  featureKey: FeatureKey, 
  currentCount: number
) {
  const { canPerformAction, isLoading, tier } = useSubscription({ venueId });
  const result = canPerformAction(featureKey, currentCount);

  return {
    ...result,
    isLoading,
    currentTier: tier,
  };
}

// Re-export feature keys for convenience
export { FEATURE_KEYS };
