/**
 * PULSE Skill Assessment — adaptive question engine (pure).
 *
 * Decides which item to ask next given the answers so far. Deterministic
 * (no Date / Math.random): the same responses always yield the same next
 * item, which is what makes save-and-resume safe and testable.
 *
 * Flow
 *   1. Foundation phase — everyone answers the foundation items in order.
 *   2. Targeted phase — using a running level estimate, ask items near the
 *      player's level, probe suspected strengths/weaknesses, chase
 *      contradiction follow-ups, and skip clearly-inappropriate items.
 *   3. Stop when coverage is sufficient, the cap is hit, or no eligible
 *      item remains (early stop for low-level players).
 *
 * It calls the pure scoring engine for the running estimate but never
 * touches the DB or the match-based PULSE Performance Rating.
 */
import {
  ESSENTIAL_SUBSKILLS,
  type AssessmentItem,
  type Subskill,
  isScored,
} from "./model";
import { MIN_SUBSKILL_EVIDENCE, scoreAssessment, type Responses } from "./scoring";

export interface AdaptiveConfig {
  /** Don't stop (on coverage) before this many answered items. */
  minItems: number;
  /** Hard ceiling on answered items. */
  maxItems: number;
  /** Evidence target per essential subskill before coverage is "met". */
  essentialEvidenceTarget: number;
}

export const DEFAULT_ADAPTIVE_CONFIG: AdaptiveConfig = {
  minItems: 44,
  maxItems: 60,
  essentialEvidenceTarget: 3,
};

/* ------------------------------------------------------------------ */
/*  Internal helpers                                                  */
/* ------------------------------------------------------------------ */

function activeBank(bank: readonly AssessmentItem[]): AssessmentItem[] {
  return bank.filter((it) => it.active);
}

function answeredCount(bank: AssessmentItem[], responses: Responses): number {
  return bank.filter((it) => responses[it.itemKey] !== undefined).length;
}

/** Evidence (scored answers) per subskill so far. */
function subskillEvidence(bank: AssessmentItem[], responses: Responses): Record<Subskill, number> {
  const out = {} as Record<Subskill, number>;
  for (const it of bank) {
    const r = responses[it.itemKey];
    if (r === undefined || !isScored(r)) continue;
    out[it.subskill] = (out[it.subskill] ?? 0) + 1;
  }
  return out;
}

/** Contradiction groups currently flagged by the scoring engine. */
function flaggedGroups(bank: AssessmentItem[], responses: Responses): Set<string> {
  const snap = scoreAssessment(bank, responses);
  return new Set(snap.contradictions.map((c) => c.group));
}

function runningLevel(bank: AssessmentItem[], responses: Responses): number {
  if (Object.keys(responses).length === 0) return 3.0; // neutral prior
  return scoreAssessment(bank, responses).estimatedLevelRaw;
}

/* ------------------------------------------------------------------ */
/*  Eligibility & scoring of candidate items                          */
/* ------------------------------------------------------------------ */

function isEligible(it: AssessmentItem, running: number, flagged: Set<string>): boolean {
  // Contradiction follow-ups bypass the level window.
  if (it.contradictionGroup && flagged.has(it.contradictionGroup)) return true;
  if (it.adaptive?.onContradiction && flagged.has(it.adaptive.onContradiction)) return true;

  const a = it.adaptive;
  if (a?.minRunningLevel != null && running < a.minRunningLevel - 0.25) return false;
  if (a?.maxRunningLevel != null && running > a.maxRunningLevel + 0.25) return false;

  // Anchor window: skip clearly-too-advanced and excessively-easy items.
  if (it.anchorLevel > running + 1.0) return false;
  const easyFloor = it.isEssential ? running - 2.0 : running - 1.5;
  if (it.anchorLevel < easyFloor) return false;
  return true;
}

function candidateScore(
  it: AssessmentItem,
  running: number,
  evidence: Record<Subskill, number>,
  flagged: Set<string>,
  cfg: AdaptiveConfig,
): number {
  let s = 0;
  // Contradiction follow-up: highest priority.
  if ((it.contradictionGroup && flagged.has(it.contradictionGroup)) || (it.adaptive?.onContradiction && flagged.has(it.adaptive.onContradiction))) {
    s += 100;
  }
  // Evidence deficit for this subskill.
  const target = ESSENTIAL_SUBSKILLS.includes(it.subskill) ? cfg.essentialEvidenceTarget : MIN_SUBSKILL_EVIDENCE;
  const deficit = Math.max(0, target - (evidence[it.subskill] ?? 0));
  s += deficit * 12;
  if (it.isEssential) s += 4;
  // Closeness to the running level (prefer items that discriminate here).
  s += Math.max(0, 2 - Math.abs(it.anchorLevel - running)) * 3;
  return s;
}

/* ------------------------------------------------------------------ */
/*  Public API                                                        */
/* ------------------------------------------------------------------ */

/** True when the essential subskills have all reached the evidence target. */
export function essentialCoverageMet(
  bank: readonly AssessmentItem[],
  responses: Responses,
  cfg: AdaptiveConfig = DEFAULT_ADAPTIVE_CONFIG,
): boolean {
  const ev = subskillEvidence(activeBank(bank), responses);
  return ESSENTIAL_SUBSKILLS.every((s) => (ev[s] ?? 0) >= cfg.essentialEvidenceTarget);
}

/**
 * The next item key to present, or null when the assessment is complete.
 * Pure & deterministic ⇒ safe to call again after a resume.
 */
export function selectNextItemKey(
  bank: readonly AssessmentItem[],
  responses: Responses,
  cfg: AdaptiveConfig = DEFAULT_ADAPTIVE_CONFIG,
): string | null {
  const items = activeBank(bank);
  const answered = answeredCount(items, responses);
  if (answered >= cfg.maxItems) return null;

  // --- Foundation phase: ask foundation items in canonical order first. ---
  const foundation = items
    .filter((it) => it.phase === "foundation")
    .sort((x, y) => x.order - y.order);
  const nextFoundation = foundation.find((it) => responses[it.itemKey] === undefined);
  if (nextFoundation) return nextFoundation.itemKey;

  // --- Targeted phase. ---
  const running = runningLevel(items, responses);
  const flagged = flaggedGroups(items, responses);
  const evidence = subskillEvidence(items, responses);

  const coverageMet = ESSENTIAL_SUBSKILLS.every((s) => (evidence[s] ?? 0) >= cfg.essentialEvidenceTarget);
  const hasFlaggedFollowup = items.some(
    (it) => responses[it.itemKey] === undefined && it.contradictionGroup != null && flagged.has(it.contradictionGroup),
  );
  if (answered >= cfg.minItems && coverageMet && !hasFlaggedFollowup) return null;

  const candidates = items
    .filter((it) => it.phase === "targeted" && responses[it.itemKey] === undefined && isEligible(it, running, flagged));
  if (candidates.length === 0) return null; // early stop — nothing appropriate left

  let best = candidates[0];
  let bestScore = -Infinity;
  for (const it of candidates) {
    const sc = candidateScore(it, running, evidence, flagged, cfg);
    // Deterministic tie-break by canonical order.
    if (sc > bestScore || (sc === bestScore && it.order < best.order)) {
      best = it;
      bestScore = sc;
    }
  }
  return best.itemKey;
}

export function isComplete(
  bank: readonly AssessmentItem[],
  responses: Responses,
  cfg: AdaptiveConfig = DEFAULT_ADAPTIVE_CONFIG,
): boolean {
  return selectNextItemKey(bank, responses, cfg) === null;
}

/**
 * Simulate a full adaptive run against a fixed set of answers (test/util).
 * Returns the order items were asked in and the resulting responses.
 * `answers` maps itemKey → response; missing keys are answered "not_sure".
 */
export function simulateAdaptive(
  bank: readonly AssessmentItem[],
  answers: Responses,
  cfg: AdaptiveConfig = DEFAULT_ADAPTIVE_CONFIG,
): { asked: string[]; responses: Responses } {
  const asked: string[] = [];
  const responses: Responses = {};
  // Hard safety bound well above maxItems.
  for (let guard = 0; guard < bank.length + 5; guard++) {
    const next = selectNextItemKey(bank, responses, cfg);
    if (next === null) break;
    asked.push(next);
    responses[next] = answers[next] ?? "not_sure";
  }
  return { asked, responses };
}
