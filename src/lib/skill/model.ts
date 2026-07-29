/**
 * PULSE Skill Assessment — domain model & shared constants.
 *
 * This module is PURE: no React, no Supabase, no side effects. It defines
 * the vocabulary the scoring engine, adaptive engine, question bank, and
 * (later) the UI all share, so nothing downstream re-invents an enum.
 *
 * Terminology (kept distinct on purpose — never combined):
 *   • PULSE Self-Assessed Level    — from this structured assessment.
 *   • PULSE Skill Fingerprint      — the per-subskill breakdown below.
 *   • PULSE Observed Skill         — future organizer/coach/court eval.
 *   • PULSE Performance Rating     — the existing match-based engine (Postgres).
 *
 * This assessment NEVER writes to or reads back into the performance rating.
 */

/* ------------------------------------------------------------------ */
/*  Versions — bump when the meaning of stored data changes.          */
/* ------------------------------------------------------------------ */

/** Question-bank version. Stored on every response + attempt. */
export const ASSESSMENT_VERSION = 1;
/** Scoring-model version. Stored on every snapshot so history stays
 *  interpretable when the math evolves. */
export const SCORING_MODEL_VERSION = 1;

/* ------------------------------------------------------------------ */
/*  Broad domains (9)                                                 */
/* ------------------------------------------------------------------ */

export const DOMAINS = [
  "rally_foundation",
  "serve_return",
  "baseline_offense",
  "soft_game",
  "transition",
  "net_offense",
  "defense",
  "positioning_teamwork",
  "strategy",
] as const;
export type Domain = (typeof DOMAINS)[number];

export const DOMAIN_LABELS: Record<Domain, string> = {
  rally_foundation: "Rally foundation",
  serve_return: "Serve & return",
  baseline_offense: "Baseline offense",
  soft_game: "Soft game",
  transition: "Transition",
  net_offense: "Net offense",
  defense: "Defense",
  positioning_teamwork: "Positioning & teamwork",
  strategy: "Strategy & competitive execution",
};

/* ------------------------------------------------------------------ */
/*  Subskills (16)                                                    */
/* ------------------------------------------------------------------ */

export const SUBSKILLS = [
  "serve",
  "return",
  "forehand",
  "backhand",
  "drive",
  "third_shot_drop",
  "dinking",
  "dink_strategy",
  "speedups",
  "counters",
  "volleys",
  "resets_defense",
  "transition_play",
  "overheads_lobs",
  "positioning",
  "strategy",
] as const;
export type Subskill = (typeof SUBSKILLS)[number];

export const SUBSKILL_LABELS: Record<Subskill, string> = {
  serve: "Serve",
  return: "Return of serve",
  forehand: "Forehand groundstroke",
  backhand: "Backhand groundstroke",
  drive: "Drive",
  third_shot_drop: "Third-shot drop",
  dinking: "Dinking",
  dink_strategy: "Dink strategy & patience",
  speedups: "Speedups & attacks",
  counters: "Counters & hands",
  volleys: "Volleys",
  resets_defense: "Resets & defensive control",
  transition_play: "Transition-zone play",
  overheads_lobs: "Overheads & lobs",
  positioning: "Positioning & partnership",
  strategy: "Strategy & competitive execution",
};

/** Which broad domain each subskill rolls up into. */
export const SUBSKILL_DOMAIN: Record<Subskill, Domain> = {
  serve: "serve_return",
  return: "serve_return",
  forehand: "baseline_offense",
  backhand: "baseline_offense",
  drive: "baseline_offense",
  third_shot_drop: "soft_game",
  dinking: "soft_game",
  dink_strategy: "soft_game",
  speedups: "net_offense",
  counters: "net_offense",
  volleys: "net_offense",
  resets_defense: "defense",
  transition_play: "transition",
  overheads_lobs: "net_offense",
  positioning: "positioning_teamwork",
  strategy: "strategy",
};

/** Grouping for progressive disclosure on the fingerprint screen. */
export const SUBSKILL_GROUPS: { key: string; label: string; subskills: Subskill[] }[] = [
  { key: "baseline", label: "Baseline", subskills: ["serve", "return", "forehand", "backhand", "drive"] },
  { key: "soft_game", label: "Soft game", subskills: ["third_shot_drop", "dinking", "dink_strategy"] },
  { key: "transition", label: "Transition", subskills: ["transition_play", "resets_defense"] },
  { key: "net_offense", label: "Net offense", subskills: ["speedups", "counters", "volleys", "overheads_lobs"] },
  { key: "team_play", label: "Team play", subskills: ["positioning", "strategy"] },
];

/**
 * Essential doubles skills. A player cannot compensate for a weakness in
 * these by scoring highly on power skills — they act as hard floors when
 * a candidate level is being decided.
 */
export const ESSENTIAL_SUBSKILLS: Subskill[] = [
  "serve",
  "return",
  "dinking",
  "third_shot_drop",
  "resets_defense",
  "positioning",
];
export function isEssentialSubskill(s: Subskill): boolean {
  return ESSENTIAL_SUBSKILLS.includes(s);
}

/* ------------------------------------------------------------------ */
/*  Scoring dimensions & their default weights                        */
/* ------------------------------------------------------------------ */

export const DIMENSIONS = ["execution", "consistency", "application", "pressure"] as const;
export type Dimension = (typeof DIMENSIONS)[number];

/** Default per-dimension weights (sum to 1). Per-item exceptions allowed. */
export const DIMENSION_WEIGHTS: Record<Dimension, number> = {
  execution: 0.3,
  consistency: 0.3,
  application: 0.25,
  pressure: 0.15,
};

/* ------------------------------------------------------------------ */
/*  Response scale                                                    */
/* ------------------------------------------------------------------ */

export const RESPONSE_KEYS = [
  "not_yet",
  "drill_only",
  "occasionally",
  "sometimes",
  "usually",
  "reliably",
  "not_sure",
] as const;
export type ResponseKey = (typeof RESPONSE_KEYS)[number];

/**
 * Internal mastery value for a response. `not_sure` is deliberately
 * `null` — excluded from mastery, but counted by the confidence model.
 * Player-facing UI must NEVER render these numbers.
 */
export const RESPONSE_MASTERY: Record<ResponseKey, number | null> = {
  not_yet: 0.0,
  drill_only: 0.2,
  occasionally: 0.4,
  sometimes: 0.6,
  usually: 0.8,
  reliably: 1.0,
  not_sure: null,
};

export const RESPONSE_LABELS: Record<ResponseKey, string> = {
  not_yet: "Not yet",
  drill_only: "Drill only",
  occasionally: "Occasionally",
  sometimes: "Sometimes",
  usually: "Usually",
  reliably: "Reliably",
  not_sure: "Not sure",
};

export const RESPONSE_DESCRIPTIONS: Record<ResponseKey, string> = {
  not_yet: "I cannot currently perform this skill.",
  drill_only: "I understand it or can perform it in controlled practice.",
  occasionally: "I perform it in fewer than about 30% of relevant game situations.",
  sometimes: "I perform it in about 30–59% of relevant situations.",
  usually: "I perform it in about 60–79% of relevant situations.",
  reliably: "I perform it at least about 80% of the time, including under pressure.",
  not_sure: "I don't have enough experience to answer accurately.",
};

/** True when a response contributes to mastery (i.e. not `not_sure`). */
export function isScored(key: ResponseKey): boolean {
  return RESPONSE_MASTERY[key] !== null;
}

/* ------------------------------------------------------------------ */
/*  Anchor levels & display bands                                     */
/* ------------------------------------------------------------------ */

/** Anchor levels an item can be pinned to. Never shown to players. */
export const ANCHOR_LEVELS = [2.0, 2.5, 3.0, 3.5, 4.0, 4.5] as const;
export type AnchorLevel = (typeof ANCHOR_LEVELS)[number];

/** A self-assessment can never produce a level above this. */
export const SELF_ASSESSMENT_CAP = 4.7;

export interface LevelBand {
  key: string;
  label: string;
  /** Inclusive lower bound on the raw (unrounded) level. */
  min: number;
  /** Exclusive upper bound. */
  max: number;
}

/** Descriptive bands. Boundaries are on the RAW level; display rounds to 0.1. */
export const LEVEL_BANDS: LevelBand[] = [
  { key: "new", label: "New Player", min: 1.0, max: 2.0 },
  { key: "beginner", label: "Beginner", min: 2.0, max: 2.5 },
  { key: "adv_beginner", label: "Advanced Beginner", min: 2.5, max: 3.0 },
  { key: "low_intermediate", label: "Low Intermediate", min: 3.0, max: 3.25 },
  { key: "intermediate", label: "Intermediate", min: 3.25, max: 3.5 },
  { key: "high_intermediate", label: "High Intermediate", min: 3.5, max: 4.0 },
  { key: "advanced", label: "Advanced", min: 4.0, max: 4.5 },
  { key: "expert", label: "Expert", min: 4.5, max: 4.8 },
];

/** Map a raw level to its descriptive band. Clamps to the ends. */
export function bandForLevel(raw: number): LevelBand {
  const v = clamp(raw, 1.0, SELF_ASSESSMENT_CAP);
  for (const b of LEVEL_BANDS) {
    if (v >= b.min && v < b.max) return b;
  }
  // v === top of range (e.g. exactly the cap) → Expert.
  return LEVEL_BANDS[LEVEL_BANDS.length - 1];
}

/** Round a raw level to one decimal place for display (half-up). */
export function displayLevel(raw: number): number {
  return Math.round(clamp(raw, 1.0, SELF_ASSESSMENT_CAP) * 10) / 10;
}

/* ------------------------------------------------------------------ */
/*  Assessment item shape (matches skill_assessment_items table)      */
/* ------------------------------------------------------------------ */

/** When an item is presented in the adaptive flow. */
export type ItemPhase = "foundation" | "targeted";

export interface PrerequisiteRule {
  /** Item that must already be answered. */
  itemKey?: string;
  /** Minimum mastery on that item for this one to unlock (0..1). */
  minScore?: number;
}

export interface AdaptiveRule {
  /** Show this item only when the running level estimate is in this window. */
  minRunningLevel?: number;
  maxRunningLevel?: number;
  /** Show as a follow-up when this contradiction group is flagged. */
  onContradiction?: string;
  /** Show when its subskill is a suspected strength or weakness. */
  onSubskillProbe?: "strength" | "weakness";
}

export interface AssessmentItem {
  itemKey: string;
  version: number;
  text: string;
  domain: Domain;
  subskill: Subskill;
  /** Null for rules/knowledge items with no motor dimension. */
  dimension: Dimension | null;
  anchorLevel: AnchorLevel;
  weight: number;
  isEssential: boolean;
  /** Items sharing a group are cross-checked for contradictions. */
  contradictionGroup: string | null;
  prerequisite: PrerequisiteRule | null;
  adaptive: AdaptiveRule | null;
  phase: ItemPhase;
  order: number;
  active: boolean;
}

/* ------------------------------------------------------------------ */
/*  Small shared helpers                                              */
/* ------------------------------------------------------------------ */

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
