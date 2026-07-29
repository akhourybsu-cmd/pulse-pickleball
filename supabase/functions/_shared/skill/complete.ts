/**
 * PULSE Skill Assessment — server-authoritative completion core.
 *
 * PURE and environment-neutral (no Supabase/Deno/React): it validates the
 * stored responses against the versioned question bank and INDEPENDENTLY
 * recomputes the authoritative snapshot with the shared scoring engine.
 *
 * The Deno edge function (skill-complete) calls this after loading the
 * attempt + responses from the database; the Vitest parity test calls it
 * to prove the server path and the client engine produce identical
 * results. There is exactly one scoring formula — this module imports the
 * same mirrored engine the client uses.
 *
 * A client-supplied score is never read: the only client input honored is
 * each item's response_key. Everything derived is computed here.
 */
import {
  ASSESSMENT_VERSION,
  RESPONSE_KEYS,
  SCORING_MODEL_VERSION,
  type ResponseKey,
} from "./model.ts";
import { QUESTION_BANK_V1 } from "./questionBank.ts";
import { scoreAssessment, type ScoringSnapshot } from "./scoring.ts";

export const SUPPORTED_ASSESSMENT_VERSIONS = [ASSESSMENT_VERSION] as const;
export const SUPPORTED_SCORING_MODEL_VERSIONS = [SCORING_MODEL_VERSION] as const;

/** Minimum scored answers before a completion is accepted. */
export const MIN_RESPONSES_TO_COMPLETE = 20;

export type CompletionErrorCode =
  | "unsupported_assessment_version"
  | "unsupported_scoring_model_version"
  | "invalid_response"
  | "invalid_question_reference"
  | "insufficient_responses";

export interface StoredResponse {
  item_key: string;
  response_key: string;
}

export type CompletionResult =
  | { ok: true; snapshot: ScoringSnapshot; scoringModelVersion: number }
  | { ok: false; code: CompletionErrorCode; message: string };

const RESPONSE_SET = new Set<string>(RESPONSE_KEYS as readonly string[]);

/**
 * Validate + recompute. `responses` are the AUTHORITATIVE rows loaded from
 * the DB (item_key + response_key only). Any score/level the client might
 * have sent is intentionally not part of the input surface.
 */
export function computeAuthoritativeResult(input: {
  assessmentVersion: number;
  responses: StoredResponse[];
  scoringModelVersion?: number;
}): CompletionResult {
  const { assessmentVersion, responses } = input;

  if (!SUPPORTED_ASSESSMENT_VERSIONS.includes(assessmentVersion as never)) {
    return { ok: false, code: "unsupported_assessment_version", message: `Assessment version ${assessmentVersion} is not supported.` };
  }
  const targetModel = input.scoringModelVersion ?? SCORING_MODEL_VERSION;
  if (!SUPPORTED_SCORING_MODEL_VERSIONS.includes(targetModel as never)) {
    return { ok: false, code: "unsupported_scoring_model_version", message: `Scoring model version ${targetModel} is not supported.` };
  }

  // Active bank for this assessment version.
  const active = QUESTION_BANK_V1.filter((it) => it.active && it.version === assessmentVersion);
  const activeKeys = new Set(active.map((it) => it.itemKey));

  const resolved: Record<string, ResponseKey> = {};
  for (const r of responses) {
    if (!RESPONSE_SET.has(r.response_key)) {
      return { ok: false, code: "invalid_response", message: `Invalid response "${r.response_key}" for ${r.item_key}.` };
    }
    if (!activeKeys.has(r.item_key)) {
      // Inactive or mismatched question reference — reject rather than guess.
      return { ok: false, code: "invalid_question_reference", message: `Response references unknown/inactive item "${r.item_key}".` };
    }
    resolved[r.item_key] = r.response_key as ResponseKey;
  }

  const scoredCount = Object.values(resolved).filter((k) => k !== "not_sure").length;
  if (scoredCount < MIN_RESPONSES_TO_COMPLETE) {
    return { ok: false, code: "insufficient_responses", message: `Need at least ${MIN_RESPONSES_TO_COMPLETE} scored answers to complete (${scoredCount} given).` };
  }

  const snapshot = scoreAssessment(active, resolved);
  return { ok: true, snapshot, scoringModelVersion: SCORING_MODEL_VERSION };
}
