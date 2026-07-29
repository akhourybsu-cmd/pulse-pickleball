/**
 * PULSE Skill Assessment — pure scoring engine.
 *
 * ZERO React / Supabase / IO. Every function is deterministic and
 * independently unit-testable (no Date.now / Math.random). The React app
 * and any future edge function both call `scoreAssessment()`; the result
 * is stored verbatim as the immutable `scoring_snapshot`.
 *
 * It NEVER touches the match-based PULSE Performance Rating.
 *
 * Pipeline
 *   responses ──▶ item mastery ──▶ cumulative mastery per anchor
 *            ├▶ subskill levels (interpolated) + coverage + confidence
 *            ├▶ overall level  (65% skill / 20% essential floor / 15% strategy
 *            │                  blend, gated by essential floors + contradictions,
 *            │                  then candidate-level pass + interpolation, capped 4.7)
 *            ├▶ confidence     (independent of skill; ≤70 without external evidence)
 *            ├▶ contradictions (reduce confidence + gate high levels; never invalidate)
 *            ├▶ styles         (rule-based; primary + optional secondary)
 *            └▶ strengths / development priorities (traceable to evidence)
 */
import {
  ANCHOR_LEVELS,
  DIMENSION_WEIGHTS,
  ESSENTIAL_SUBSKILLS,
  RESPONSE_MASTERY,
  SCORING_MODEL_VERSION,
  SELF_ASSESSMENT_CAP,
  SUBSKILLS,
  SUBSKILL_DOMAIN,
  DOMAINS,
  bandForLevel,
  clamp,
  displayLevel,
  type AnchorLevel,
  type AssessmentItem,
  type Domain,
  type ResponseKey,
  type Subskill,
} from "./model.ts";

/* ------------------------------------------------------------------ */
/*  Tunable constants (documented; version-pinned via SCORING_MODEL_VERSION) */
/* ------------------------------------------------------------------ */

/** Cumulative mastery required for a candidate anchor level to pass. */
export const PASS_THRESHOLD = 0.72;
/** Lower bound of the interpolation window toward the next level. */
export const INTERP_LOWER = 0.35;
/** Essential-domain mastery floor a candidate level must clear. */
export const ESSENTIAL_FLOOR = 0.58;
/** Minimum answered+scored items before a subskill earns a shown score. */
export const MIN_SUBSKILL_EVIDENCE = 2;
/** Overall-blend weights (sum to 1). */
export const OVERALL_WEIGHTS = { skillAvg: 0.65, essentialFloor: 0.2, strategy: 0.15 } as const;
/** Contradiction severity a candidate at anchor ≥ 4.0 may not exceed. */
export const CONTRADICTION_HIGH_GATE = 1;

/* ------------------------------------------------------------------ */
/*  Inputs / outputs                                                  */
/* ------------------------------------------------------------------ */

/** itemKey → chosen response. Unanswered items are simply absent. */
export type Responses = Record<string, ResponseKey>;

/** Optional real-world corroboration. Absent ⇒ pure self-assessment. */
export interface ScoringContext {
  /** Days since the player last played (for the confidence model). */
  recentActivityDays?: number | null;
  /** Count of recent verified matches (confidence only — never skill). */
  recentMatchCount?: number | null;
  /** Future observed/performance corroboration, 0..30. */
  externalCorroboration?: number | null;
}

export interface SubskillScore {
  subskill: Subskill;
  domain: Domain;
  /** Unrounded level (store this). */
  rawLevel: number;
  /** Rounded to 0.1 for display. */
  displayLevel: number;
  confidence: number;
  evidenceCount: number;
  /** True when evidence is below MIN_SUBSKILL_EVIDENCE — label "Not enough information". */
  insufficientEvidence: boolean;
}

export interface DomainScore {
  domain: Domain;
  rawLevel: number;
  displayLevel: number;
  evidenceCount: number;
  insufficientEvidence: boolean;
}

export interface ContradictionFlag {
  group: string;
  highItemKey: string;
  lowItemKey: string;
  /** Human-readable, never accusatory. */
  note: string;
}

export type ConfidenceLabel =
  | "Low confidence"
  | "Developing confidence"
  | "Moderate confidence"
  | "High confidence"
  | "Confirmed profile";

export interface ConfidenceBreakdown {
  completionCoverage: number; // ≤20
  recentActivity: number; // ≤15
  recentMatchVolume: number; // ≤15
  internalConsistency: number; // ≤20
  externalCorroboration: number; // ≤30
  total: number; // 0..100 (≤70 without external)
  label: ConfidenceLabel;
}

export type StyleStage = "Emerging" | "Developing" | "Established" | "Advanced" | "Confirmed";

export interface StyleIdentity {
  key: string;
  label: string;
  stage: StyleStage;
  /** Ranking score (margin sum) — internal, for choosing primary/secondary. */
  strength: number;
}

export interface StrengthOrPriority {
  subskill: Subskill;
  displayLevel: number;
  /** Traceable explanation grounded in the scores. */
  reason: string;
}

export interface ScoringSnapshot {
  scoringModelVersion: number;
  /** Unrounded self-assessed level (store this). */
  estimatedLevelRaw: number;
  estimatedLevelDisplay: number;
  displayBand: string;
  lowerBound: number;
  upperBound: number;
  confidence: ConfidenceBreakdown;
  subskills: SubskillScore[];
  domains: DomainScore[];
  contradictions: ContradictionFlag[];
  primaryStyle: StyleIdentity | null;
  secondaryStyle: StyleIdentity | null;
  strengths: StrengthOrPriority[];
  developmentPriorities: StrengthOrPriority[];
  /** Diagnostics for tests/debugging (never shown to players). */
  meta: {
    answeredCount: number;
    scoredCount: number;
    notSureCount: number;
    contradictionSeverity: number;
    highestPassedAnchor: number | null;
    overallMasteryByAnchor: Record<string, number>;
  };
}

/* ------------------------------------------------------------------ */
/*  Item mastery helpers                                              */
/* ------------------------------------------------------------------ */

/** Effective weight = item weight × dimension weight (dimensionless ≈ application). */
function effectiveWeight(item: AssessmentItem): number {
  const dimW = item.dimension ? DIMENSION_WEIGHTS[item.dimension] : 0.25;
  return item.weight * dimW;
}

interface Answered {
  item: AssessmentItem;
  mastery: number | null; // null = "not sure"
}

/** Resolve responses against the (active) bank into answered records. */
function collect(items: readonly AssessmentItem[], responses: Responses): Answered[] {
  const out: Answered[] = [];
  for (const item of items) {
    if (!item.active) continue;
    const r = responses[item.itemKey];
    if (r === undefined) continue;
    out.push({ item, mastery: RESPONSE_MASTERY[r] });
  }
  return out;
}

/** Weighted mastery over the given answered+scored records (null ⇒ 0..1 avg, empty ⇒ null). */
function weightedMastery(records: Answered[]): number | null {
  let num = 0;
  let den = 0;
  for (const a of records) {
    if (a.mastery === null) continue; // not sure — excluded from mastery
    const w = effectiveWeight(a.item);
    num += w * a.mastery;
    den += w;
  }
  return den === 0 ? null : num / den;
}

/** Cumulative weighted mastery over records with anchorLevel ≤ `anchor`. */
function cumulativeMasteryAtAnchor(records: Answered[], anchor: number): number | null {
  return weightedMastery(records.filter((a) => a.item.anchorLevel <= anchor));
}

/* ------------------------------------------------------------------ */
/*  Candidate-level pass + interpolation (shared by overall & subskill) */
/* ------------------------------------------------------------------ */

function nextLevelProgress(nextMastery: number | null): number {
  if (nextMastery === null) return 0;
  return clamp((nextMastery - INTERP_LOWER) / (PASS_THRESHOLD - INTERP_LOWER), 0, 1);
}

/**
 * Interpolate a continuous level from a mastery-at-anchor function.
 * `passes(anchor)` decides whether a candidate anchor is cleared.
 */
function interpolateLevel(
  masteryAt: (a: number) => number | null,
  passes: (a: number) => boolean,
): { raw: number; highestPassed: number | null } {
  const anchors = ANCHOR_LEVELS as readonly number[];
  let highestPassed: number | null = null;
  for (const a of anchors) {
    if (passes(a)) highestPassed = a;
  }
  if (highestPassed === null) {
    // Below the lowest anchor (2.0). Interpolate up from a 1.5 pseudo-floor.
    const raw = 1.5 + 0.5 * nextLevelProgress(masteryAt(anchors[0]));
    return { raw: clamp(raw, 1.0, SELF_ASSESSMENT_CAP), highestPassed: null };
  }
  const idx = anchors.indexOf(highestPassed);
  const nextAnchor = idx + 1 < anchors.length ? anchors[idx + 1] : highestPassed + 0.5;
  const raw = highestPassed + 0.5 * nextLevelProgress(masteryAt(nextAnchor));
  return { raw: clamp(raw, 1.0, SELF_ASSESSMENT_CAP), highestPassed };
}

/* ------------------------------------------------------------------ */
/*  Subskill & domain scoring                                         */
/* ------------------------------------------------------------------ */

function scoreSubskill(subskill: Subskill, answered: Answered[]): SubskillScore {
  const records = answered.filter((a) => a.item.subskill === subskill);
  const scored = records.filter((a) => a.mastery !== null);
  const evidenceCount = scored.length;
  const masteryAt = (a: number) => cumulativeMasteryAtAnchor(records, a);
  const { raw } = interpolateLevel(masteryAt, (a) => (masteryAt(a) ?? 0) >= PASS_THRESHOLD);

  const notSure = records.length - scored.length;
  // Per-subskill confidence: grows with evidence, penalised by "not sure";
  // self-only so capped at 70.
  const cov = clamp(evidenceCount / 4, 0, 1);
  const notSurePenalty = records.length ? notSure / records.length : 0;
  const confidence = Math.round(clamp(70 * cov * (1 - 0.5 * notSurePenalty), 0, 70));

  return {
    subskill,
    domain: SUBSKILL_DOMAIN[subskill],
    rawLevel: raw,
    displayLevel: displayLevel(raw),
    confidence,
    evidenceCount,
    insufficientEvidence: evidenceCount < MIN_SUBSKILL_EVIDENCE,
  };
}

function scoreDomain(domain: Domain, answered: Answered[]): DomainScore {
  const records = answered.filter((a) => a.item.domain === domain);
  const scored = records.filter((a) => a.mastery !== null);
  const masteryAt = (a: number) => cumulativeMasteryAtAnchor(records, a);
  const { raw } = interpolateLevel(masteryAt, (a) => (masteryAt(a) ?? 0) >= PASS_THRESHOLD);
  return {
    domain,
    rawLevel: raw,
    displayLevel: displayLevel(raw),
    evidenceCount: scored.length,
    insufficientEvidence: scored.length < MIN_SUBSKILL_EVIDENCE,
  };
}

/* ------------------------------------------------------------------ */
/*  Contradictions                                                    */
/* ------------------------------------------------------------------ */

/** Mastery gap that counts as "advanced rated well above its foundation". */
const CONTRADICTION_GAP = 0.4;

/**
 * Within each contradiction group, flag when the highest-anchor skill is
 * rated clearly HIGHER than the lowest-anchor skill it builds on — i.e.
 * an advanced claim that outruns its own foundation. One flag per group.
 * Never accusatory; reduces confidence and can prompt a follow-up.
 */
function detectContradictions(answered: Answered[]): ContradictionFlag[] {
  const flags: ContradictionFlag[] = [];
  const byGroup = new Map<string, Answered[]>();
  for (const a of answered) {
    const g = a.item.contradictionGroup;
    if (!g || a.mastery === null) continue;
    const arr = byGroup.get(g) ?? [];
    arr.push(a);
    byGroup.set(g, arr);
  }
  for (const [group, recs] of byGroup) {
    if (recs.length < 2) continue;
    const hi = recs.reduce((m, r) => (r.item.anchorLevel > m.item.anchorLevel ? r : m));
    const lo = recs.reduce((m, r) => (r.item.anchorLevel < m.item.anchorLevel ? r : m));
    if (hi.item.anchorLevel <= lo.item.anchorLevel) continue;
    if ((hi.mastery ?? 0) - (lo.mastery ?? 0) >= CONTRADICTION_GAP) {
      flags.push({
        group,
        highItemKey: hi.item.itemKey,
        lowItemKey: lo.item.itemKey,
        note: "A more advanced skill was rated higher than a foundational one it usually builds on — this lowers confidence and may prompt a follow-up.",
      });
    }
  }
  return flags;
}

/* ------------------------------------------------------------------ */
/*  Overall level                                                     */
/* ------------------------------------------------------------------ */

function essentialFloorMasteryAt(answered: Answered[], anchor: number): number | null {
  let floor = Infinity;
  let seen = false;
  for (const s of ESSENTIAL_SUBSKILLS) {
    const recs = answered.filter((a) => a.item.subskill === s);
    const m = cumulativeMasteryAtAnchor(recs, anchor);
    if (m === null) continue; // no evidence yet for this essential at/below anchor
    seen = true;
    floor = Math.min(floor, m);
  }
  return seen ? floor : null;
}

/* ------------------------------------------------------------------ */
/*  Confidence                                                        */
/* ------------------------------------------------------------------ */

const TARGET_ANSWERED = 45; // typical completed length lower bound

function scoreConfidence(
  answered: Answered[],
  contradictionSeverity: number,
  ctx: ScoringContext,
): ConfidenceBreakdown {
  const scoredCount = answered.filter((a) => a.mastery !== null).length;
  const notSureCount = answered.length - scoredCount;

  const coverageFrac = clamp(scoredCount / TARGET_ANSWERED, 0, 1);
  const notSureFrac = answered.length ? notSureCount / answered.length : 0;
  const completionCoverage = 20 * coverageFrac * (1 - 0.5 * notSureFrac);

  const days = ctx.recentActivityDays;
  const recentActivity = days == null ? 0 : 15 * clamp((90 - days) / 90, 0, 1);

  const matches = ctx.recentMatchCount;
  const recentMatchVolume = matches == null ? 0 : 15 * clamp(matches / 10, 0, 1);

  const internalConsistency = 20 * clamp(1 - contradictionSeverity / 4, 0, 1);

  const externalCorroboration = clamp(ctx.externalCorroboration ?? 0, 0, 30);
  const hasExternal = externalCorroboration > 0;

  let total =
    completionCoverage + recentActivity + recentMatchVolume + internalConsistency + externalCorroboration;
  // A self-assessment without outside evidence can never exceed 70.
  if (!hasExternal) total = Math.min(total, 70);
  total = Math.round(clamp(total, 0, 100));

  return {
    completionCoverage: round1(completionCoverage),
    recentActivity: round1(recentActivity),
    recentMatchVolume: round1(recentMatchVolume),
    internalConsistency: round1(internalConsistency),
    externalCorroboration: round1(externalCorroboration),
    total,
    label: confidenceLabel(total),
  };
}

export function confidenceLabel(total: number): ConfidenceLabel {
  if (total < 45) return "Low confidence";
  if (total < 60) return "Developing confidence";
  if (total < 75) return "Moderate confidence";
  if (total < 90) return "High confidence";
  return "Confirmed profile";
}

/* ------------------------------------------------------------------ */
/*  Styles                                                            */
/* ------------------------------------------------------------------ */

interface StyleRule {
  key: string;
  label: string;
  /** Subskills whose average defines the style's core level. */
  core: Subskill[];
  /** Minimum core level. */
  minLevel: number;
  /** Minimum margin of core level above the profile average. */
  minMargin: number;
  /** Minimum average confidence across core subskills. */
  minConfidence: number;
  /** Essential subskills that, if too weak, disqualify the style. */
  disqualifyIfEssentialBelow?: number;
}

const STYLE_RULES: StyleRule[] = [
  { key: "aggressive_driver", label: "Aggressive Driver", core: ["drive", "forehand"], minLevel: 3.6, minMargin: 0.25, minConfidence: 65 },
  { key: "soft_game_specialist", label: "Soft-Game Specialist", core: ["dinking", "third_shot_drop", "dink_strategy"], minLevel: 3.5, minMargin: 0.2, minConfidence: 60 },
  { key: "kitchen_controller", label: "Kitchen Controller", core: ["dinking", "dink_strategy"], minLevel: 3.7, minMargin: 0.3, minConfidence: 60 },
  { key: "attacking_finisher", label: "Attacking Finisher", core: ["speedups", "volleys"], minLevel: 3.7, minMargin: 0.25, minConfidence: 65 },
  { key: "defensive_counterpuncher", label: "Defensive Counterpuncher", core: ["resets_defense", "counters"], minLevel: 3.6, minMargin: 0.25, minConfidence: 60 },
  { key: "transition_specialist", label: "Transition Specialist", core: ["transition_play", "resets_defense"], minLevel: 3.6, minMargin: 0.25, minConfidence: 60 },
  { key: "strategic_builder", label: "Strategic Builder", core: ["strategy", "dink_strategy"], minLevel: 3.6, minMargin: 0.2, minConfidence: 60 },
  { key: "all_court_player", label: "All-Court Player", core: ["drive", "dinking", "resets_defense", "volleys"], minLevel: 3.6, minMargin: 0.1, minConfidence: 65 },
  { key: "reliable_stabilizer", label: "Reliable Stabilizer", core: ["serve", "return", "positioning"], minLevel: 3.4, minMargin: 0.1, minConfidence: 60, disqualifyIfEssentialBelow: 3.0 },
];

function styleStage(level: number, confidence: number): StyleStage {
  if (level >= 4.3 && confidence >= 75) return "Confirmed";
  if (level >= 4.0) return "Advanced";
  if (level >= 3.5) return "Established";
  if (level >= 3.0) return "Developing";
  return "Emerging";
}

function assignStyles(
  subskills: SubskillScore[],
  profileAvg: number,
): { primary: StyleIdentity | null; secondary: StyleIdentity | null } {
  const byKey = new Map(subskills.map((s) => [s.subskill, s]));
  const essentialMin = Math.min(
    ...ESSENTIAL_SUBSKILLS.map((s) => byKey.get(s)?.rawLevel ?? 0),
  );

  const qualifying: StyleIdentity[] = [];
  for (const rule of STYLE_RULES) {
    const cores = rule.core.map((s) => byKey.get(s)).filter((x): x is SubskillScore => !!x);
    if (cores.length < rule.core.length) continue;
    if (cores.some((c) => c.insufficientEvidence)) continue;
    const coreLevel = avg(cores.map((c) => c.rawLevel));
    const coreConf = avg(cores.map((c) => c.confidence));
    if (coreLevel < rule.minLevel) continue;
    if (coreLevel - profileAvg < rule.minMargin) continue;
    if (coreConf < rule.minConfidence) continue;
    if (rule.disqualifyIfEssentialBelow != null && essentialMin < rule.disqualifyIfEssentialBelow) continue;
    qualifying.push({
      key: rule.key,
      label: rule.label,
      stage: styleStage(coreLevel, coreConf),
      strength: coreLevel - profileAvg + (coreLevel - rule.minLevel),
    });
  }
  qualifying.sort((a, b) => b.strength - a.strength);
  return { primary: qualifying[0] ?? null, secondary: qualifying[1] ?? null };
}

/* ------------------------------------------------------------------ */
/*  Strengths & development priorities                                */
/* ------------------------------------------------------------------ */

const STRENGTH_ABS = 3.3;
const STRENGTH_MARGIN = 0.25;

function pickStrengths(subskills: SubskillScore[], overall: number): StrengthOrPriority[] {
  return subskills
    .filter((s) => !s.insufficientEvidence && s.rawLevel >= STRENGTH_ABS && s.rawLevel - overall >= STRENGTH_MARGIN && s.confidence >= 55)
    .sort((a, b) => b.rawLevel - a.rawLevel)
    .slice(0, 3)
    .map((s) => ({
      subskill: s.subskill,
      displayLevel: s.displayLevel,
      reason: `Rated ${s.displayLevel.toFixed(1)}, ${(s.rawLevel - overall).toFixed(1)} above your overall level with ${s.evidenceCount} supporting answers.`,
    }));
}

function pickPriorities(subskills: SubskillScore[], overall: number): StrengthOrPriority[] {
  const byKey = new Map(subskills.map((s) => [s.subskill, s]));
  // Essential weaknesses first, then largest gaps below overall.
  const candidates = subskills
    .filter((s) => !s.insufficientEvidence)
    .map((s) => {
      const essential = ESSENTIAL_SUBSKILLS.includes(s.subskill);
      const gap = overall - s.rawLevel; // positive = below overall
      const impact = (essential ? 1.4 : 1.0) * Math.max(gap, 0) + (essential && s.rawLevel < 3.0 ? 0.5 : 0);
      return { s, essential, gap, impact };
    })
    .filter((c) => c.gap > 0.1 || (c.essential && c.s.rawLevel < 3.0))
    .sort((a, b) => b.impact - a.impact)
    .slice(0, 3);
  void byKey;
  return candidates.map(({ s, essential, gap }) => ({
    subskill: s.subskill,
    displayLevel: s.displayLevel,
    reason: essential
      ? `Essential doubles skill at ${s.displayLevel.toFixed(1)} — lifting it has the most impact on your next level.`
      : `At ${s.displayLevel.toFixed(1)}, about ${gap.toFixed(1)} below your overall level.`,
  }));
}

/* ------------------------------------------------------------------ */
/*  Entry point                                                       */
/* ------------------------------------------------------------------ */

export function scoreAssessment(
  items: readonly AssessmentItem[],
  responses: Responses,
  ctx: ScoringContext = {},
): ScoringSnapshot {
  const answered = collect(items, responses);
  const contradictions = detectContradictions(answered);
  const contradictionSeverity = contradictions.length;

  // --- subskills & domains ---
  const subskills = SUBSKILLS.map((s) => scoreSubskill(s, answered));
  const domains = DOMAINS.map((d) => scoreDomain(d, answered));

  // --- overall (blended mastery, gated by essential floors + contradictions) ---
  const skillMasteryAt = (a: number) => cumulativeMasteryAtAnchor(answered, a);
  const strategyRecs = answered.filter((x) => x.item.subskill === "strategy");
  const strategyMasteryAt = (a: number) => cumulativeMasteryAtAnchor(strategyRecs, a);

  const overallMasteryAt = (a: number): number | null => {
    const skill = skillMasteryAt(a);
    if (skill === null) return null;
    const floor = essentialFloorMasteryAt(answered, a) ?? skill;
    const strat = strategyMasteryAt(a) ?? skill;
    return OVERALL_WEIGHTS.skillAvg * skill + OVERALL_WEIGHTS.essentialFloor * floor + OVERALL_WEIGHTS.strategy * strat;
  };

  const passes = (a: number): boolean => {
    const om = overallMasteryAt(a);
    if (om === null || om < PASS_THRESHOLD) return false;
    const floor = essentialFloorMasteryAt(answered, a);
    if (floor !== null && floor < ESSENTIAL_FLOOR) return false; // essential gate
    if (a >= 4.0 && contradictionSeverity > CONTRADICTION_HIGH_GATE) return false; // contradiction gate on high levels
    return true;
  };

  const { raw: estimatedLevelRaw, highestPassed } = interpolateLevel(overallMasteryAt, passes);
  const cappedRaw = clamp(estimatedLevelRaw, 1.0, SELF_ASSESSMENT_CAP);

  // --- confidence (independent of skill) ---
  const confidence = scoreConfidence(answered, contradictionSeverity, ctx);

  // --- likely range: wider when confidence is lower ---
  const halfWidth = clamp(0.35 - confidence.total / 400, 0.1, 0.35);
  const lowerBound = displayLevel(cappedRaw - halfWidth);
  const upperBound = displayLevel(Math.min(cappedRaw + halfWidth, SELF_ASSESSMENT_CAP));

  // --- styles / strengths / priorities ---
  const evaluated = subskills.filter((s) => !s.insufficientEvidence);
  const profileAvg = evaluated.length ? avg(evaluated.map((s) => s.rawLevel)) : cappedRaw;
  const { primary, secondary } = assignStyles(subskills, profileAvg);
  const strengths = pickStrengths(subskills, cappedRaw);
  const developmentPriorities = pickPriorities(subskills, cappedRaw);

  const overallMasteryByAnchor: Record<string, number> = {};
  for (const a of ANCHOR_LEVELS) {
    const m = overallMasteryAt(a);
    if (m !== null) overallMasteryByAnchor[String(a)] = round3(m);
  }

  return {
    scoringModelVersion: SCORING_MODEL_VERSION,
    estimatedLevelRaw: round3(cappedRaw),
    estimatedLevelDisplay: displayLevel(cappedRaw),
    displayBand: bandForLevel(cappedRaw).label,
    lowerBound,
    upperBound,
    confidence,
    subskills,
    domains,
    contradictions,
    primaryStyle: primary,
    secondaryStyle: secondary,
    strengths,
    developmentPriorities,
    meta: {
      answeredCount: answered.length,
      scoredCount: answered.filter((a) => a.mastery !== null).length,
      notSureCount: answered.filter((a) => a.mastery === null).length,
      contradictionSeverity,
      highestPassedAnchor: highestPassed,
      overallMasteryByAnchor,
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Tiny numeric helpers                                              */
/* ------------------------------------------------------------------ */

function avg(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
function round1(v: number): number {
  return Math.round(v * 10) / 10;
}
function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}

/** Re-exported for callers that only need the anchor list typed. */
export type { AnchorLevel };
