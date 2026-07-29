/**
 * PULSE Skill Assessment — league eligibility engine (pure).
 *
 * Deterministic evaluation of whether a player's skill measurement fits a
 * league's optional eligibility config. It is PREPARED for a future join /
 * substitute-matching pass but is NOT wired into any enforcement yet — the
 * caller decides what to do with the verdict.
 *
 * When a config is disabled (the default), everyone is eligible: the
 * foundation never blocks an existing flow.
 *
 * It reads only the SELF-ASSESSED (or observed/performance) LEVEL — never a
 * raw response — and never mixes measurement sources silently.
 */

export type SkillSource = "self" | "observed" | "performance";
export type ProvisionalPolicy = "allow" | "require_review" | "block";

export interface LeagueSkillEligibility {
  enabled: boolean;
  minLevel: number | null;
  maxLevel: number | null;
  acceptedSources: SkillSource[];
  acceptSelfAssessment: boolean;
  minConfidence: number;
  allowOrganizerApproval: boolean;
  allowPlayingUp: boolean; // below min, with approval
  allowPlayingDown: boolean; // above max
  provisionalPolicy: ProvisionalPolicy;
}

export interface PlayerSkillForEligibility {
  level: number | null;
  confidence: number | null;
  provisional: boolean;
  source: SkillSource | null;
}

export type EligibilityStatus =
  | "eligible"
  | "config_disabled"
  | "no_assessment"
  | "source_not_accepted"
  | "low_confidence"
  | "provisional_blocked"
  | "below_min"
  | "above_max";

export interface EligibilityResult {
  eligible: boolean;
  /** True when an organizer could approve an otherwise-ineligible player. */
  needsApproval: boolean;
  status: EligibilityStatus;
  /** Short, non-accusatory explanation for the organizer UI. */
  message: string;
}

/** Sensible default config (matches the DB defaults; disabled ⇒ no-op). */
export const DEFAULT_ELIGIBILITY: LeagueSkillEligibility = {
  enabled: false,
  minLevel: null,
  maxLevel: null,
  acceptedSources: ["self"],
  acceptSelfAssessment: true,
  minConfidence: 0,
  allowOrganizerApproval: true,
  allowPlayingUp: true,
  allowPlayingDown: true,
  provisionalPolicy: "allow",
};

export function evaluateEligibility(
  settings: LeagueSkillEligibility,
  player: PlayerSkillForEligibility,
): EligibilityResult {
  // Inactive foundation → never blocks anything.
  if (!settings.enabled) {
    return { eligible: true, needsApproval: false, status: "config_disabled", message: "Eligibility rules are off for this league." };
  }

  const approve = settings.allowOrganizerApproval;

  if (player.level == null || player.source == null) {
    return { eligible: false, needsApproval: approve, status: "no_assessment",
      message: approve ? "No skill measurement yet — organizer approval required." : "A skill measurement is required to join." };
  }

  // Source gating (never silently mix measurement types).
  const sourceOk = settings.acceptedSources.includes(player.source)
    && (player.source !== "self" || settings.acceptSelfAssessment);
  if (!sourceOk) {
    return { eligible: false, needsApproval: approve, status: "source_not_accepted",
      message: approve ? "This measurement source isn't accepted — organizer approval required." : "This measurement source isn't accepted for this league." };
  }

  if ((player.confidence ?? 0) < settings.minConfidence) {
    return { eligible: false, needsApproval: approve, status: "low_confidence",
      message: approve ? "Assessment confidence is below the league minimum — organizer review suggested." : "Assessment confidence is below the league minimum." };
  }

  if (player.provisional) {
    if (settings.provisionalPolicy === "block") {
      return { eligible: false, needsApproval: false, status: "provisional_blocked", message: "Provisional profiles aren't accepted for this league." };
    }
    if (settings.provisionalPolicy === "require_review") {
      return { eligible: false, needsApproval: approve, status: "provisional_blocked", message: "Provisional profile — organizer review required before joining." };
    }
    // 'allow' → fall through to range checks.
  }

  if (settings.minLevel != null && player.level < settings.minLevel) {
    return { eligible: false, needsApproval: settings.allowPlayingUp && approve, status: "below_min",
      message: settings.allowPlayingUp ? "Below the league's minimum level — may play up with organizer approval." : "Below the league's minimum level." };
  }

  if (settings.maxLevel != null && player.level > settings.maxLevel) {
    // Playing down is typically allowed outright when the league permits it.
    return { eligible: settings.allowPlayingDown, needsApproval: false, status: "above_max",
      message: settings.allowPlayingDown ? "Above the league's level, but playing down is allowed." : "Above the league's maximum level." };
  }

  return { eligible: true, needsApproval: false, status: "eligible", message: "Within the league's accepted range." };
}
