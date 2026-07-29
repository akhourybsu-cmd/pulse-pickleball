/**
 * PULSE Skill Assessment — deterministic persona fixtures.
 *
 * Pure, seed-free test data: each persona is described by a "true" level
 * per subskill, and answers every bank item by comparing the item's
 * hidden anchor to that true level. Used by personas.test.ts to verify
 * results are plausible and explainable. No Math.random / no Date.
 */
import {
  QUESTION_BANK_V1,
} from "./questionBank";
import {
  SUBSKILLS,
  type ResponseKey,
  type Subskill,
} from "./model";
import type { Responses } from "./scoring";

/** Response notches, low → high mastery. */
const NOTCHES: ResponseKey[] = ["not_yet", "drill_only", "occasionally", "sometimes", "usually", "reliably"];

/**
 * Map (anchor − trueLevel) to a response; pressure items drop one notch.
 * Tuned to give realistic spread against the 0.72 pass line: a player
 * performs a skill "reliably" only when it's well below their level,
 * "sometimes" at their level, and "occasionally"/worse above it.
 */
function responseForDiff(diff: number, isPressure: boolean): ResponseKey {
  let idx: number;
  if (diff <= -1.0) idx = 5; // reliably — well below their level
  else if (diff <= -0.5) idx = 4; // usually — comfortably below
  else if (diff <= 0.0) idx = 3; // sometimes — at their level
  else if (diff <= 0.5) idx = 2; // occasionally — just above
  else if (diff <= 1.0) idx = 1; // drill only — clearly above
  else idx = 0; // not_yet — well above their level
  if (isPressure) idx = Math.max(0, idx - 1);
  return NOTCHES[idx];
}

export interface Persona {
  key: string;
  label: string;
  /** Fallback true level for subskills not explicitly set. */
  defaultLevel: number;
  /** Per-subskill true levels (2.0–4.7 scale). */
  levels?: Partial<Record<Subskill, number>>;
  /** Fraction (0..1) of items answered "not sure" instead of scored. */
  notSureRate?: number;
  /** Force specific responses (used for the inflated/contradictory persona). */
  overrides?: Record<string, ResponseKey>;
  /** Subskills the player cannot demonstrate (answered "not sure"). */
  notSureSubskills?: Subskill[];
}

/** Build a full response set for a persona over the whole bank. */
export function buildResponses(p: Persona): Responses {
  const out: Responses = {};
  // Deterministic pseudo-spread for notSureRate (index-based, no RNG).
  let i = 0;
  for (const item of QUESTION_BANK_V1) {
    if (p.overrides && p.overrides[item.itemKey]) {
      out[item.itemKey] = p.overrides[item.itemKey];
      i++;
      continue;
    }
    if (p.notSureSubskills?.includes(item.subskill)) {
      out[item.itemKey] = "not_sure";
      i++;
      continue;
    }
    if (p.notSureRate && (i % Math.round(1 / p.notSureRate)) === 0) {
      out[item.itemKey] = "not_sure";
      i++;
      continue;
    }
    const trueLevel = p.levels?.[item.subskill] ?? p.defaultLevel;
    out[item.itemKey] = responseForDiff(item.anchorLevel - trueLevel, item.dimension === "pressure");
    i++;
  }
  return out;
}

const uniform = (lvl: number): Partial<Record<Subskill, number>> =>
  Object.fromEntries(SUBSKILLS.map((s) => [s, lvl])) as Partial<Record<Subskill, number>>;

export const PERSONAS: Persona[] = [
  { key: "new_player", label: "New player", defaultLevel: 1.7 },
  {
    key: "beginner_inconsistent",
    label: "Beginner with inconsistent contact",
    defaultLevel: 2.2,
    levels: { forehand: 2.1, backhand: 2.0, drive: 2.2, third_shot_drop: 2.0, resets_defense: 2.0 },
  },
  {
    key: "adv_beginner_positioning",
    label: "Advanced beginner with basic positioning",
    defaultLevel: 2.7,
    levels: { positioning: 3.0, serve: 2.8, return: 2.8 },
  },
  {
    key: "low_int_power",
    label: "Low intermediate power-oriented",
    defaultLevel: 3.0,
    levels: { drive: 3.7, forehand: 3.6, serve: 3.4, third_shot_drop: 2.7, dinking: 2.7, resets_defense: 2.6, transition_play: 2.7 },
  },
  { key: "intermediate_balanced", label: "Intermediate balanced", defaultLevel: 3.3, levels: uniform(3.3) },
  {
    key: "high_int_driver",
    label: "High-intermediate aggressive driver",
    defaultLevel: 3.6,
    levels: { drive: 4.1, forehand: 4.0, serve: 3.9, speedups: 3.8, dinking: 3.5, third_shot_drop: 3.5, resets_defense: 3.4, positioning: 3.6 },
  },
  {
    key: "high_int_soft",
    label: "High-intermediate soft-game specialist",
    defaultLevel: 3.6,
    levels: { dinking: 4.1, dink_strategy: 4.0, third_shot_drop: 4.0, drive: 3.3, speedups: 3.3, serve: 3.5, return: 3.6, resets_defense: 3.7, positioning: 3.8 },
  },
  {
    key: "adv_counterpuncher",
    label: "Advanced defensive counterpuncher",
    defaultLevel: 4.0,
    levels: { resets_defense: 4.4, counters: 4.3, transition_play: 4.2, drive: 3.8, dinking: 4.1, positioning: 4.1, serve: 3.9, return: 4.0 },
  },
  { key: "adv_all_court", label: "Advanced all-court player", defaultLevel: 4.1, levels: uniform(4.1) },
  {
    key: "inflated_contradictory",
    label: "Inflated & contradictory responses",
    defaultLevel: 2.6,
    // Rates advanced skills far higher than the easier ones they build on,
    // WITHIN the same contradiction group → several contradiction flags.
    overrides: {
      bh_under_pressure: "reliably", // backhand_gap (4.0) …
      bh_consistent: "occasionally", // … vs foundational backhand (2.5)
      rs_kitchen: "reliably", // reset_claim (4.0) …
      rs_feet: "occasionally", // … vs feet reset (3.5)
      dk_recover: "reliably", // dink_control (4.0) …
      dk_height: "occasionally", // … vs low-dink height (3.5)
      ts_follow: "reliably", // kitchen_presence (3.5) …
      rt_advance: "occasionally", // … vs advancing after the return (3.0)
    },
  },
  { key: "many_not_sure", label: "Many 'not sure' responses", defaultLevel: 3.0, notSureRate: 0.5 },
  {
    key: "adaptive_functional",
    label: "Adaptive/wheelchair player with strong functional skill",
    defaultLevel: 3.5,
    levels: { dinking: 3.9, dink_strategy: 3.9, counters: 3.8, volleys: 3.7, serve: 3.6, return: 3.5, positioning: 3.6, strategy: 3.7 },
    // Skills gated by standing mobility are answered "not sure" rather than penalised.
    notSureSubskills: ["overheads_lobs"],
  },
];

export function personaByKey(key: string): Persona | undefined {
  return PERSONAS.find((p) => p.key === key);
}
