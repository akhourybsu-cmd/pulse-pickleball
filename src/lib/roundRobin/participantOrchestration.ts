/**
 * Slice 2b — stable public client surface for round-robin participant changes.
 *
 * Per Amendment 5, the client ALWAYS goes through the server orchestration
 * layer (the `rr-manage-participant` Edge Function) and never composes plans
 * itself. The Edge Function snapshots the event, runs the Slice 3 planner, and
 * calls the transactional apply RPC. This is what enables `reoptimize` / `auto`
 * end-to-end without changing the DB RPC's public contract.
 *
 * Two entry points:
 *   - previewParticipantChange(input) — compute the plan, write nothing.
 *   - manageParticipant(input)        — compute the plan and apply it.
 *
 * The legacy `callRrManageParticipant` in `manageParticipantRpc.ts` (direct RPC,
 * local-repair only) is retained for the existing organizer UI until Slice 4
 * migrates it onto this surface.
 */

import { supabase } from "@/integrations/supabase/client";

export type ParticipantChangeActionInput =
  | "withdraw"
  | "injure"
  | "remove"
  | "replace"
  | "restore";

export type RegenModeInput = "minimal" | "reoptimize" | "auto";

export interface ManageParticipantInput {
  eventId: string;
  /** round_robin_players.id of the participant being changed. */
  participantId: string;
  action: ParticipantChangeActionInput;
  /** round_robin_players.id of the substitute (action=replace). */
  substituteId?: string;
  reason?: string;
  regenMode?: RegenModeInput;
  /**
   * Raw substitute payload forwarded to the RPC (guest details / user_id).
   * When omitted, `substituteId` is wrapped as `{ participant_id }`.
   */
  substitute?: Record<string, unknown>;
  /** Required when the participant is in the active/live match. */
  activeMatchResolution?: {
    kind: "finish_and_record" | "restart_with_substitute" | "abandon";
  };
  /** Client-generated idempotency key; one per user action. */
  requestId?: string;
}

export interface OrchestrationResult {
  ok: boolean;
  code?: string;
  message?: string;
  retryable?: boolean;
  requestId?: string;
  planHash?: string;
  /** The planner's `ParticipantChangePlan` (present on both ok and !ok). */
  plan?: unknown;
  /** The RPC response (present on a successful apply). */
  response?: unknown;
  fairnessTriggers?: string[];
  details?: Record<string, unknown> | null;
}

function newRequestId(): string {
  return (
    (globalThis.crypto as { randomUUID?: () => string } | undefined)?.randomUUID?.() ??
    `req-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

async function invoke(
  input: ManageParticipantInput,
  previewOnly: boolean,
): Promise<OrchestrationResult> {
  const requestId = input.requestId ?? newRequestId();
  const { data, error } = await supabase.functions.invoke("rr-manage-participant", {
    body: {
      eventId: input.eventId,
      participantId: input.participantId,
      action: input.action,
      substituteId: input.substituteId,
      reason: input.reason ?? null,
      regenMode: input.regenMode ?? "auto",
      previewOnly,
      requestId,
      substitute: input.substitute,
      activeMatchResolution: input.activeMatchResolution ?? null,
    },
  });

  if (error) {
    // Network / function-invocation failure (not an application error, which
    // the function returns as a 200 with { ok:false }).
    return { ok: false, code: "invoke_failed", message: error.message, requestId };
  }
  return { requestId, ...(data as OrchestrationResult) };
}

/** Compute the plan for a participant change without writing anything. */
export function previewParticipantChange(
  input: ManageParticipantInput,
): Promise<OrchestrationResult> {
  return invoke(input, true);
}

/** Compute and atomically apply a participant change. */
export function manageParticipant(
  input: ManageParticipantInput,
): Promise<OrchestrationResult> {
  return invoke(input, false);
}

/**
 * Known application-level error codes the apply RPC / planner can return. Any
 * failure whose code is NOT in this set (a transport failure, or a PostgREST
 * "function not found" because the Slice 2b migration/function isn't deployed
 * yet) is treated as an infrastructure error the caller may safely retry via
 * the legacy direct-RPC path.
 */
const APPLICATION_ERROR_CODES = new Set<string>([
  "stale_version",
  "not_authorized",
  "not_authenticated",
  "event_not_mutable",
  "event_not_found",
  "invalid_input",
  "invalid_action",
  "invalid_regen_mode",
  "participant_not_found",
  "invalid_state_transition",
  "substitute_required",
  "substitute_invalid",
  "substitute_not_eligible",
  "substitute_payload_conflict",
  "guest_name_required",
  "guest_name_too_long",
  "guest_gender_invalid",
  "duplicate_guest_requires_confirmation",
  "duplicate_participant_identity",
  "restore_replacement_conflict",
  "active_match_resolution_required",
  "invalid_active_match_resolution",
  "final_score_required",
  "multiple_active_matches",
  "minimal_regen_not_possible",
  "reoptimization_required",
  "idempotency_conflict",
  "request_in_progress",
  "invalid_plan",
  "plan_action_mismatch",
  "planner_failed",
]);

/**
 * True when a failed result reflects the orchestration layer being unavailable
 * (edge function / migration not deployed, or a network error) rather than a
 * legitimate rejection. Callers use this to decide whether to fall back to the
 * legacy direct RPC so roster changes never break during rollout.
 */
export function isInfrastructureError(result: OrchestrationResult): boolean {
  if (result.ok) return false;
  return !result.code || !APPLICATION_ERROR_CODES.has(result.code);
}

/** Human-readable copy for the error codes the organizer UI surfaces. */
export function friendlyParticipantError(result: OrchestrationResult): string {
  switch (result.code) {
    case "stale_version":
      return "The roster changed while you were editing. Reload and try again.";
    case "active_match_resolution_required":
      return "This player is in the live match. Finish or void that match first, then try again.";
    case "minimal_regen_not_possible":
      return "No simple swap covers this change — try again with re-optimization.";
    case "reoptimization_required":
      return "This change needs the remaining rounds re-optimized, which isn't possible right now.";
    case "substitute_not_eligible":
      return "The chosen replacement isn't an active roster member.";
    case "substitute_required":
      return "Pick a replacement player to substitute in.";
    case "duplicate_participant_identity":
      return "That player is already in this event.";
    case "invalid_state_transition":
      return (result.details?.message as string) ?? "That change isn't allowed from the current status.";
    case "not_authorized":
      return "Only the event organizer can make roster changes.";
    case "event_not_mutable":
      return "This event is completed or voided — roster changes are locked.";
    default:
      return result.message || "Roster change failed.";
  }
}
