/**
 * Thin wrapper around the transactional `rr_manage_participant` RPC.
 *
 * Slice 2b (minimal) uses this from the organizer's Player Management dialog
 * for two actions:
 *   - remove (was: soft-deactivate)
 *   - replace (global substitution)
 *
 * Add-new-player and single-round substitution intentionally still use the
 * legacy direct-write path — the RPC only mutates existing roster rows.
 *
 * The wrapper handles:
 *   - request_id generation (idempotency key, one per user action)
 *   - schedule_version snapshot (optimistic concurrency guard)
 *   - decoding the structured error payload the RPC raises in `DETAIL`
 */

import { supabase } from "@/integrations/supabase/client";

export type RRManageAction = "remove" | "replace" | "withdraw" | "injure" | "restore";

export interface RRManageParticipantInput {
  eventId: string;
  playerId: string; // round_robin_players.id (roster row id)
  action: RRManageAction;
  reason?: string;
  /** For action=replace: the roster-row id of the active substitute. */
  substituteParticipantId?: string;
  /** How to resolve if the target is currently in the live match. */
  activeMatchResolution?: {
    kind: "finish_and_record" | "restart_with_substitute" | "abandon";
  };
  regenMode?: "minimal" | "reoptimize" | "auto";
}

export interface RRManageParticipantError extends Error {
  code: string;
  details?: Record<string, unknown>;
}

function decodeRpcError(err: any): RRManageParticipantError {
  // supabase-js exposes Postgres error DETAIL under `details`.
  const raw = err?.details ?? err?.message ?? "";
  let payload: any = null;
  try {
    if (typeof raw === "string" && raw.trim().startsWith("{")) {
      payload = JSON.parse(raw);
    }
  } catch {
    /* fall through */
  }
  const code = payload?.code ?? err?.code ?? "unknown_error";
  const message = payload?.message ?? err?.message ?? "Request failed";
  const out = new Error(message) as RRManageParticipantError;
  out.code = code;
  out.details = payload ?? undefined;
  return out;
}

export async function callRrManageParticipant(
  input: RRManageParticipantInput,
): Promise<{ requestId: string; response: any }> {
  const requestId =
    (globalThis.crypto as any)?.randomUUID?.() ??
    `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  // Snapshot schedule_version right before the call so the RPC can reject
  // stale-view mutations. Missing/errored read → skip the guard rather than
  // fail-closed (the RPC will still bump the version atomically).
  const { data: evt } = await supabase
    .from("round_robin_events")
    .select("schedule_version")
    .eq("id", input.eventId)
    .maybeSingle();
  const expectedVersion =
    (evt as any)?.schedule_version ?? undefined;

  const { data, error } = await supabase.rpc("rr_manage_participant", {
    p_request_id: requestId,
    p_event_id: input.eventId,
    p_player_id: input.playerId,
    p_action: input.action,
    p_reason: input.reason ?? null,
    p_expected_version: expectedVersion,
    p_regen_mode: input.regenMode ?? "auto",
    p_preview_only: false,
    p_substitute: input.substituteParticipantId
      ? { participant_id: input.substituteParticipantId }
      : undefined,
    p_active_match_resolution: input.activeMatchResolution ?? undefined,
  } as any);

  if (error) throw decodeRpcError(error);
  return { requestId, response: data };
}

/**
 * Human-readable message for the error codes the organizer UI cares about.
 * Anything not listed here falls back to the RPC's own message.
 */
export function friendlyRpcError(err: RRManageParticipantError): string {
  switch (err.code) {
    case "stale_version":
      return "The roster changed while you were editing. Reload and try again.";
    case "active_match_resolution_required":
      return "This player is in the live match. Finish or void that match first, then try again.";
    case "substitute_not_eligible":
      return "The chosen replacement isn't an active roster member.";
    case "substitute_required":
      return "Pick a replacement player to substitute in.";
    case "invalid_state_transition":
      return err.details?.message as string ?? "That change isn't allowed from the current status.";
    case "not_authorized":
      return "Only the event organizer can make roster changes.";
    case "event_not_mutable":
      return "This event is completed or voided — roster changes are locked.";
    default:
      return err.message || "Roster change failed.";
  }
}
