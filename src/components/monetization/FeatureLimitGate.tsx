/**
 * Feature gate component for checking limits before actions
 */

import { ReactNode } from "react";
import { useSubscription, FEATURE_KEYS } from "@/hooks/useSubscription";
import { useVenueUsage } from "@/hooks/useVenueUsage";
import { UpgradePrompt } from "./UpgradePrompt";
import type { FeatureKey } from "@/lib/monetization";

interface FeatureLimitGateProps {
  venueId: string | null;
  featureKey: FeatureKey;
  /** What to render when feature is available */
  children: ReactNode;
  /** Optional: custom usage count (if not using auto-detected usage) */
  currentCount?: number;
  /** Optional: render something different when limit is reached */
  renderLimitReached?: (limit: number, current: number) => ReactNode;
  /** Optional: hide completely when limit reached instead of showing upgrade prompt */
  hideWhenLimited?: boolean;
}

/**
 * Wraps content that should only be accessible within feature limits.
 * Automatically checks usage and shows upgrade prompts when limits are reached.
 */
export function FeatureGate({
  venueId,
  featureKey,
  children,
  currentCount,
  renderLimitReached,
  hideWhenLimited = false,
}: FeatureLimitGateProps) {
  const { canPerformAction, tier, isLoading: subLoading } = useSubscription({ venueId });
  const { usage, isLoading: usageLoading } = useVenueUsage({ venueId });

  const isLoading = subLoading || usageLoading;

  // Auto-detect current count based on feature key
  const getAutoCount = (): number => {
    if (currentCount !== undefined) return currentCount;
    
    switch (featureKey) {
      case FEATURE_KEYS.MAX_EVENTS_PER_MONTH:
        return usage.eventsThisMonth;
      case FEATURE_KEYS.MAX_COURTS:
        return usage.totalCourts;
      case FEATURE_KEYS.MAX_COACHES:
        return usage.totalCoaches;
      default:
        return 0;
    }
  };

  const count = getAutoCount();
  const { allowed, limit, upgradeRequired } = canPerformAction(featureKey, count);

  // Still loading
  if (isLoading) {
    return <>{children}</>;
  }

  // Feature is available
  if (allowed) {
    return <>{children}</>;
  }

  // Limit reached
  if (hideWhenLimited) {
    return null;
  }

  if (renderLimitReached && limit !== null) {
    return <>{renderLimitReached(limit, count)}</>;
  }

  // Default upgrade prompt
  return (
    <UpgradePrompt
      featureName={getFeatureName(featureKey)}
      currentTier={tier}
      requiredTier={getRequiredTierForFeature(featureKey)}
    />
  );
}

/**
 * Hook version for programmatic checks
 */
export function useFeatureGate(
  venueId: string | null, 
  featureKey: FeatureKey,
  customCount?: number
) {
  const { canPerformAction, tier, isLoading: subLoading } = useSubscription({ venueId });
  const { usage, isLoading: usageLoading } = useVenueUsage({ venueId });

  const isLoading = subLoading || usageLoading;

  const getAutoCount = (): number => {
    if (customCount !== undefined) return customCount;
    
    switch (featureKey) {
      case FEATURE_KEYS.MAX_EVENTS_PER_MONTH:
        return usage.eventsThisMonth;
      case FEATURE_KEYS.MAX_COURTS:
        return usage.totalCourts;
      case FEATURE_KEYS.MAX_COACHES:
        return usage.totalCoaches;
      default:
        return 0;
    }
  };

  const count = getAutoCount();
  const result = canPerformAction(featureKey, count);

  return {
    ...result,
    currentCount: count,
    currentTier: tier,
    isLoading,
  };
}

// Helper functions
function getFeatureName(featureKey: FeatureKey): string {
  switch (featureKey) {
    case FEATURE_KEYS.MAX_EVENTS_PER_MONTH:
      return "monthly events";
    case FEATURE_KEYS.MAX_COURTS:
      return "courts";
    case FEATURE_KEYS.MAX_COACHES:
      return "coaches";
    case FEATURE_KEYS.ANALYTICS_ADVANCED:
      return "advanced analytics";
    case FEATURE_KEYS.CUSTOM_BRANDING:
      return "custom branding";
    case FEATURE_KEYS.PRIORITY_SUPPORT:
      return "priority support";
    case FEATURE_KEYS.ANALYTICS_BASIC:
      return "basic analytics";
    default:
      return "this feature";
  }
}

function getRequiredTierForFeature(featureKey: FeatureKey): "plus" | "pro" | "enterprise" {
  switch (featureKey) {
    case FEATURE_KEYS.MAX_EVENTS_PER_MONTH:
    case FEATURE_KEYS.MAX_COURTS:
    case FEATURE_KEYS.MAX_COACHES:
      return "plus"; // Higher limits start at Plus
    case FEATURE_KEYS.ANALYTICS_ADVANCED:
    case FEATURE_KEYS.CUSTOM_BRANDING:
      return "pro";
    case FEATURE_KEYS.PRIORITY_SUPPORT:
      return "enterprise";
    default:
      return "plus";
  }
}
