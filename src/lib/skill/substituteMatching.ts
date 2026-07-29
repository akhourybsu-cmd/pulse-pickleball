/**
 * PULSE Skill Assessment — substitute-matching engine (pure).
 *
 * Given an ABSENT player and one or more candidate fill-ins, produce a
 * deterministic "fit" score so an organizer can see, at a glance, which
 * available subs are the closest match for the person who's out.
 *
 * Design constraints (mirrors the eligibility engine):
 *   • Deterministic & pure — no Date.now / Math.random, same inputs ⇒ same
 *     output. Safe to unit-test and to reason about.
 *   • It NEVER auto-rejects anyone. Every candidate always remains selectable;
 *     the score is advisory ranking only. A weak survey signal lowers a rank,
 *     it does not remove a player.
 *   • It reads only the SELF-ASSESSED LEVEL (or observed/performance level) and
 *     coarse style/side/confidence signals — never a raw survey response.
 *   • It never touches, and must never be confused with, the PULSE Performance
 *     Rating.
 *
 * Product intent (from the spec): a missing player rated ~3.5 should normally
 * prioritise substitutes roughly between 3.25 and 3.75, with a preferred band
 * closer to the missing player. Style, preferred side, and confidence refine
 * ties but never dominate raw level proximity.
 */

import {
  evaluateEligibility,
  type LeagueSkillEligibility,
  type EligibilityResult,
} from "./eligibility.ts";

/** ±band around the absent player's level that counts as an ideal match. */
export const PREFERRED_BAND = 0.25;
/** ±band that is still a comfortable, sensible fill-in. */
export const ACCEPTABLE_BAND = 0.5;

/** Relative weights of the fit factors. Level proximity dominates by design. */
export const FIT_WEIGHTS = {
  level: 0.6,
  style: 0.2,
  side: 0.1,
  confidence: 0.1,
} as const;

export type FitTier = "great" | "good" | "playable" | "stretch" | "unknown";

/** What we know about the player who can't make it. */
export interface AbsentPlayerSkill {
  level: number | null;
  primaryStyle: string | null;
  secondaryStyle: string | null;
  /** 'left' | 'right' | 'either' | 'no_preference' | null */
  preferredSide: string | null;
}

/** What we know about a candidate fill-in. */
export interface CandidateSkill {
  level: number | null;
  confidence: number | null;
  provisional: boolean;
  primaryStyle: string | null;
  secondaryStyle: string | null;
  preferredSide: string | null;
  /** Inactive/benched subs can still be ranked but are flagged, never removed. */
  active?: boolean;
}

export interface SubstituteFit {
  /** Overall 0..1 advisory fit. Higher is a closer fill-in. */
  score: number;
  tier: FitTier;
  /** Signed candidate − absent level (null when either level is missing). */
  levelDelta: number | null;
  withinPreferredBand: boolean;
  withinAcceptableBand: boolean;
  /** True once we have enough (both levels) to say anything meaningful. */
  hasData: boolean;
  /** Short, non-accusatory notes for the organizer UI. */
  reasons: string[];
  /**
   * Optional advisory verdict from the league's eligibility config, when one
   * was supplied. Purely informational here — matching never enforces it.
   */
  eligibility?: EligibilityResult;
}

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

/** Concrete, comparable side ('either'/'no_preference'/null ⇒ flexible). */
function normSide(side: string | null): "left" | "right" | null {
  return side === "left" || side === "right" ? side : null;
}

/**
 * Level-proximity credit as a function of absolute delta:
 *   ≤ PREFERRED_BAND       → 1.0        (ideal)
 *   PREFERRED..ACCEPTABLE  → 1.0 → 0.6  (comfortable)
 *   ACCEPTABLE..1.0        → 0.6 → 0.2  (a stretch, still fine)
 *   > 1.0                  → 0.2 → ~0.0 (far, but never rejected)
 * Continuous & monotonic so ranking is stable and explicable.
 */
function levelProximityScore(delta: number): number {
  const d = Math.abs(delta);
  if (d <= PREFERRED_BAND) return 1;
  if (d <= ACCEPTABLE_BAND) {
    const t = (d - PREFERRED_BAND) / (ACCEPTABLE_BAND - PREFERRED_BAND);
    return 1 - t * 0.4; // 1.0 → 0.6
  }
  if (d <= 1.0) {
    const t = (d - ACCEPTABLE_BAND) / (1.0 - ACCEPTABLE_BAND);
    return 0.6 - t * 0.4; // 0.6 → 0.2
  }
  // Beyond a full level: decay toward (but never to) zero.
  const t = clamp01((d - 1.0) / 1.0);
  return clamp01(0.2 - t * 0.2); // 0.2 → 0.0
}

/**
 * Style similarity in [0,1]:
 *   1.0  → same primary style
 *   0.6  → one player's primary matches the other's secondary
 *   0.35 → secondaries match (both have one)
 *   0.5  → neutral prior when either style is unknown (don't punish missing data)
 *   0.15 → both known but no overlap
 */
function styleScore(absent: AbsentPlayerSkill, cand: CandidateSkill): number {
  const ap = absent.primaryStyle, as = absent.secondaryStyle;
  const cp = cand.primaryStyle, cs = cand.secondaryStyle;
  if (!ap || !cp) return 0.5; // unknown → neutral, never a penalty signal
  if (ap === cp) return 1;
  if (ap === cs || cp === as) return 0.6;
  if (as && cs && as === cs) return 0.35;
  return 0.15;
}

/**
 * Preferred-side compatibility in [0,1]. A sub who plays the same side slots
 * in cleanly; opposite sides still work (0.4); a flexible player is a safe 0.85.
 */
function sideScore(absent: AbsentPlayerSkill, cand: CandidateSkill): number {
  const a = normSide(absent.preferredSide);
  const c = normSide(cand.preferredSide);
  if (a == null || c == null) return 0.85; // flexible / unknown → safe
  return a === c ? 1 : 0.4;
}

/** Confidence in [0,1]; unknown confidence is a neutral 0.6, not a penalty. */
function confidenceScore(confidence: number | null): number {
  if (confidence == null) return 0.6;
  return clamp01(confidence / 100);
}

function tierForScore(score: number, hasData: boolean): FitTier {
  if (!hasData) return "unknown";
  if (score >= 0.85) return "great";
  if (score >= 0.7) return "good";
  if (score >= 0.5) return "playable";
  return "stretch";
}

const TIER_LABEL: Record<FitTier, string> = {
  great: "Great match",
  good: "Good match",
  playable: "Playable",
  stretch: "Stretch",
  unknown: "Level unknown",
};

export function fitTierLabel(tier: FitTier): string {
  return TIER_LABEL[tier];
}

export interface FitOptions {
  /**
   * League eligibility config. When supplied AND enabled, an advisory
   * eligibility verdict is attached (matching still never enforces it).
   */
  eligibility?: LeagueSkillEligibility | null;
}

/**
 * Score how well a single candidate fills in for the absent player.
 * Always returns a usable result; missing data degrades gracefully to a
 * lower-confidence, still-selectable score.
 */
export function scoreSubstituteFit(
  absent: AbsentPlayerSkill,
  cand: CandidateSkill,
  opts: FitOptions = {},
): SubstituteFit {
  const reasons: string[] = [];
  const hasLevels = absent.level != null && cand.level != null;
  const levelDelta = hasLevels ? (cand.level as number) - (absent.level as number) : null;
  const absDelta = levelDelta == null ? null : Math.abs(levelDelta);
  const withinPreferredBand = absDelta != null && absDelta <= PREFERRED_BAND;
  const withinAcceptableBand = absDelta != null && absDelta <= ACCEPTABLE_BAND;

  const level = absDelta == null ? 0.4 : levelProximityScore(absDelta); // unknown ⇒ mild prior
  const style = styleScore(absent, cand);
  const side = sideScore(absent, cand);
  const conf = confidenceScore(cand.confidence);

  const score = clamp01(
    FIT_WEIGHTS.level * level +
      FIT_WEIGHTS.style * style +
      FIT_WEIGHTS.side * side +
      FIT_WEIGHTS.confidence * conf,
  );

  // Human-readable, ranking-order-independent notes.
  if (!hasLevels) {
    reasons.push(cand.level == null ? "No self-assessed level yet" : "No level for the absent player");
  } else if (withinPreferredBand) {
    reasons.push("Very close level");
  } else if (withinAcceptableBand) {
    reasons.push("Similar level");
  } else if (absDelta != null && absDelta <= 1.0) {
    reasons.push(levelDelta! > 0 ? "Rated somewhat higher" : "Rated somewhat lower");
  } else if (levelDelta != null) {
    reasons.push(levelDelta > 0 ? "Rated much higher" : "Rated much lower");
  }
  if (absent.primaryStyle && cand.primaryStyle && absent.primaryStyle === cand.primaryStyle) {
    reasons.push("Same playing style");
  }
  {
    const a = normSide(absent.preferredSide), c = normSide(cand.preferredSide);
    if (a && c && a === c) reasons.push("Same preferred side");
  }
  if (cand.provisional) reasons.push("Provisional profile");
  if (cand.active === false) reasons.push("Currently benched");
  if (cand.confidence != null && cand.confidence < 60) reasons.push("Low assessment confidence");

  const tier = tierForScore(score, hasLevels);

  const result: SubstituteFit = {
    score,
    tier,
    levelDelta,
    withinPreferredBand,
    withinAcceptableBand,
    hasData: hasLevels,
    reasons,
  };

  const elig = opts.eligibility;
  if (elig && elig.enabled) {
    result.eligibility = evaluateEligibility(elig, {
      level: cand.level,
      confidence: cand.confidence,
      provisional: cand.provisional,
      source: "self",
    });
  }

  return result;
}

export interface RankedCandidate<T> {
  candidate: T;
  fit: SubstituteFit;
}

/**
 * Rank candidates best-fit-first. Deterministic and STABLE: ties (equal score)
 * keep the caller's original order, so an alphabetical input stays
 * alphabetical within a tier. Never drops a candidate.
 */
export function rankSubstitutes<T>(
  absent: AbsentPlayerSkill,
  candidates: Array<{ id: string; skill: CandidateSkill; value: T }>,
  opts: FitOptions = {},
): Array<RankedCandidate<T>> {
  const scored = candidates.map((c, index) => ({
    index,
    value: c.value,
    fit: scoreSubstituteFit(absent, c.skill, opts),
  }));
  scored.sort((a, b) => {
    if (b.fit.score !== a.fit.score) return b.fit.score - a.fit.score;
    return a.index - b.index; // stable
  });
  return scored.map((s) => ({ candidate: s.value, fit: s.fit }));
}
