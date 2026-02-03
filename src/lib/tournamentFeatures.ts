import type { Database } from "@/integrations/supabase/types";

type SubscriptionTier = Database["public"]["Enums"]["subscription_tier"];

export interface TournamentFeature {
  id: string;
  name: string;
  description: string;
  freeAllowed: boolean;
  requiredTier: SubscriptionTier | null; // null means available on free
}

/**
 * Tournament feature definitions with tier requirements.
 * Free venues CAN create and publish tournaments.
 * Premium features require paid subscriptions.
 */
export const TOURNAMENT_FEATURES: TournamentFeature[] = [
  {
    id: "create_tournament",
    name: "Create Tournament",
    description: "Create and configure tournament events",
    freeAllowed: true,
    requiredTier: null,
  },
  {
    id: "publish_tournament",
    name: "Publish Tournament",
    description: "Make tournament visible to players",
    freeAllowed: true,
    requiredTier: null,
  },
  {
    id: "external_registration",
    name: "External Registration Link",
    description: "Link to external registration (Google Form, etc.)",
    freeAllowed: true,
    requiredTier: null,
  },
  {
    id: "native_registration",
    name: "In-App Registration",
    description: "Players register directly within PULSE",
    freeAllowed: false,
    requiredTier: "plus",
  },
  {
    id: "bracket_automation",
    name: "Bracket Automation",
    description: "Automatic bracket generation and management",
    freeAllowed: false,
    requiredTier: "plus",
  },
  {
    id: "check_in_kiosk",
    name: "Check-in Kiosk Mode",
    description: "On-site player check-in with kiosk display",
    freeAllowed: false,
    requiredTier: "pro",
  },
  {
    id: "automated_comms",
    name: "Automated Messaging",
    description: "Automatic email/push notifications to players",
    freeAllowed: false,
    requiredTier: "pro",
  },
  {
    id: "analytics",
    name: "Tournament Analytics",
    description: "Detailed analytics and reporting",
    freeAllowed: false,
    requiredTier: "pro",
  },
  {
    id: "multi_day_scheduling",
    name: "Multi-Day Scheduling",
    description: "Advanced scheduling across multiple days",
    freeAllowed: false,
    requiredTier: "plus",
  },
  {
    id: "custom_branding",
    name: "Custom Branding",
    description: "Custom colors, logos, and tournament pages",
    freeAllowed: false,
    requiredTier: "pro",
  },
  {
    id: "advanced_seeding",
    name: "Advanced Seeding",
    description: "Rating-based and manual seeding with seed locking",
    freeAllowed: false,
    requiredTier: "plus",
  },
  {
    id: "visual_scheduler",
    name: "Visual Scheduler",
    description: "Day-planner grid for court and time management",
    freeAllowed: false,
    requiredTier: "pro",
  },
  {
    id: "player_score_entry",
    name: "Player Score Entry",
    description: "Allow players to self-report match scores",
    freeAllowed: false,
    requiredTier: "plus",
  },
  {
    id: "email_templates",
    name: "Email Templates",
    description: "Customizable email templates for player communication",
    freeAllowed: false,
    requiredTier: "pro",
  },
];

/**
 * Map of tier hierarchy for comparison
 */
const TIER_HIERARCHY: Record<SubscriptionTier, number> = {
  free: 0,
  plus: 1,
  pro: 2,
  enterprise: 3,
};

/**
 * Check if a tier meets the requirement for a feature
 */
export function tierMeetsRequirement(
  currentTier: SubscriptionTier,
  requiredTier: SubscriptionTier | null
): boolean {
  if (requiredTier === null) return true; // Free feature
  return TIER_HIERARCHY[currentTier] >= TIER_HIERARCHY[requiredTier];
}

/**
 * Get all features available for a given tier
 */
export function getFeaturesForTier(tier: SubscriptionTier): TournamentFeature[] {
  return TOURNAMENT_FEATURES.filter(
    (feature) => feature.freeAllowed || tierMeetsRequirement(tier, feature.requiredTier)
  );
}

/**
 * Get features that require upgrade from current tier
 */
export function getLockedFeatures(tier: SubscriptionTier): TournamentFeature[] {
  return TOURNAMENT_FEATURES.filter(
    (feature) => !feature.freeAllowed && !tierMeetsRequirement(tier, feature.requiredTier)
  );
}

/**
 * Get the feature definition by ID
 */
export function getFeatureById(featureId: string): TournamentFeature | undefined {
  return TOURNAMENT_FEATURES.find((f) => f.id === featureId);
}
