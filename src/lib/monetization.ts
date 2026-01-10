/**
 * Monetization utilities and feature gating
 */

import { supabase } from "@/integrations/supabase/client";

export type SubscriptionTier = 'free' | 'plus' | 'pro' | 'enterprise';

export interface VenueSubscription {
  id: string;
  venue_id: string;
  tier: SubscriptionTier;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  status: string;
}

export interface FeatureEntitlement {
  feature_key: string;
  limit_value: number | null;
  enabled: boolean;
}

export interface TierInfo {
  tier: SubscriptionTier;
  name: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  popular?: boolean;
}

export const TIER_INFO: Record<SubscriptionTier, TierInfo> = {
  free: {
    tier: 'free',
    name: 'Free',
    description: 'Get started with basic features',
    priceMonthly: 0,
    priceYearly: 0,
  },
  plus: {
    tier: 'plus',
    name: 'Plus',
    description: 'For growing venues',
    priceMonthly: 29,
    priceYearly: 290,
    popular: true,
  },
  pro: {
    tier: 'pro',
    name: 'Pro',
    description: 'For professional venues',
    priceMonthly: 79,
    priceYearly: 790,
  },
  enterprise: {
    tier: 'enterprise',
    name: 'Enterprise',
    description: 'Custom solutions for large organizations',
    priceMonthly: 0, // Custom pricing
    priceYearly: 0,
  },
};

/**
 * Get the subscription for a venue
 */
export async function getVenueSubscription(venueId: string): Promise<VenueSubscription | null> {
  const { data, error } = await supabase
    .from('venue_subscriptions')
    .select('*')
    .eq('venue_id', venueId)
    .single();

  if (error) {
    console.error('Error fetching venue subscription:', error);
    return null;
  }

  return data as VenueSubscription;
}

/**
 * Get feature entitlements for a tier
 */
export async function getTierEntitlements(tier: SubscriptionTier): Promise<FeatureEntitlement[]> {
  const { data, error } = await supabase
    .from('feature_entitlements')
    .select('feature_key, limit_value, enabled')
    .eq('tier', tier);

  if (error) {
    console.error('Error fetching entitlements:', error);
    return [];
  }

  return data || [];
}

/**
 * Check if a feature is enabled for a tier
 */
export async function isFeatureEnabled(
  venueId: string,
  featureKey: string
): Promise<boolean> {
  const subscription = await getVenueSubscription(venueId);
  const tier = subscription?.tier || 'free';

  const { data, error } = await supabase
    .from('feature_entitlements')
    .select('enabled')
    .eq('tier', tier)
    .eq('feature_key', featureKey)
    .single();

  if (error || !data) {
    return false;
  }

  return data.enabled;
}

/**
 * Get the limit for a feature
 */
export async function getFeatureLimit(
  venueId: string,
  featureKey: string
): Promise<number | null> {
  const subscription = await getVenueSubscription(venueId);
  const tier = subscription?.tier || 'free';

  const { data, error } = await supabase
    .from('feature_entitlements')
    .select('limit_value, enabled')
    .eq('tier', tier)
    .eq('feature_key', featureKey)
    .single();

  if (error || !data || !data.enabled) {
    return 0;
  }

  return data.limit_value; // null means unlimited
}

/**
 * Check if a venue can perform an action based on limits
 */
export async function canPerformAction(
  venueId: string,
  featureKey: string,
  currentCount: number
): Promise<{ allowed: boolean; limit: number | null; upgradeRequired: boolean }> {
  const limit = await getFeatureLimit(venueId, featureKey);

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
}

/**
 * Feature keys for type safety
 */
export const FEATURE_KEYS = {
  MAX_EVENTS_PER_MONTH: 'max_events_per_month',
  MAX_COURTS: 'max_courts',
  MAX_COACHES: 'max_coaches',
  ANALYTICS_BASIC: 'analytics_basic',
  ANALYTICS_ADVANCED: 'analytics_advanced',
  CUSTOM_BRANDING: 'custom_branding',
  PRIORITY_SUPPORT: 'priority_support',
} as const;

export type FeatureKey = typeof FEATURE_KEYS[keyof typeof FEATURE_KEYS];

/**
 * Get tier comparison for upgrade prompts
 */
export function compareTiers(current: SubscriptionTier, target: SubscriptionTier): number {
  const order: SubscriptionTier[] = ['free', 'plus', 'pro', 'enterprise'];
  return order.indexOf(target) - order.indexOf(current);
}

/**
 * Check if current tier has access to target tier features
 */
export function hasAccessToTier(current: SubscriptionTier, target: SubscriptionTier): boolean {
  return compareTiers(current, target) >= 0;
}
