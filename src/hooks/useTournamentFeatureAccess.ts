import { useMemo } from "react";
import { useSubscription } from "@/hooks/useSubscription";
import {
  TOURNAMENT_FEATURES,
  tierMeetsRequirement,
  getFeatureById,
  getFeaturesForTier,
  getLockedFeatures,
  type TournamentFeature,
} from "@/lib/tournamentFeatures";
import type { Database } from "@/integrations/supabase/types";

type SubscriptionTier = Database["public"]["Enums"]["subscription_tier"];

interface TournamentFeatureAccess {
  /** Current subscription tier */
  tier: SubscriptionTier;
  /** Whether the subscription data is still loading */
  isLoading: boolean;
  /** Check if a specific feature is accessible */
  canAccess: (featureId: string) => boolean;
  /** Get the required tier for a feature */
  getRequiredTier: (featureId: string) => SubscriptionTier | null;
  /** Get all accessible features */
  accessibleFeatures: TournamentFeature[];
  /** Get all locked features that require upgrade */
  lockedFeatures: TournamentFeature[];
  /** Check if venue is on free tier */
  isFreeTier: boolean;
  /** Check if upgrade is needed for a specific feature */
  needsUpgrade: (featureId: string) => boolean;
}

/**
 * Hook to check tournament feature access based on venue subscription
 */
export function useTournamentFeatureAccess(venueId: string | null): TournamentFeatureAccess {
  const { tier, isLoading } = useSubscription({ venueId });

  const accessibleFeatures = useMemo(() => getFeaturesForTier(tier), [tier]);
  const lockedFeatures = useMemo(() => getLockedFeatures(tier), [tier]);

  const canAccess = (featureId: string): boolean => {
    const feature = getFeatureById(featureId);
    if (!feature) return false;
    if (feature.freeAllowed) return true;
    return tierMeetsRequirement(tier, feature.requiredTier);
  };

  const getRequiredTier = (featureId: string): SubscriptionTier | null => {
    const feature = getFeatureById(featureId);
    return feature?.requiredTier || null;
  };

  const needsUpgrade = (featureId: string): boolean => {
    const feature = getFeatureById(featureId);
    if (!feature) return false;
    if (feature.freeAllowed) return false;
    return !tierMeetsRequirement(tier, feature.requiredTier);
  };

  return {
    tier,
    isLoading,
    canAccess,
    getRequiredTier,
    accessibleFeatures,
    lockedFeatures,
    isFreeTier: tier === "free",
    needsUpgrade,
  };
}

/**
 * Simple hook to check a single feature
 */
export function useTournamentFeature(venueId: string | null, featureId: string) {
  const { canAccess, needsUpgrade, getRequiredTier, isLoading } = useTournamentFeatureAccess(venueId);

  return {
    canAccess: canAccess(featureId),
    needsUpgrade: needsUpgrade(featureId),
    requiredTier: getRequiredTier(featureId),
    isLoading,
  };
}
