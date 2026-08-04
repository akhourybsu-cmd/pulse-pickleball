/**
 * Client-side detection of the "live match" a roster member is currently in.
 *
 * When an organizer removes or substitutes a player mid-event, the
 * transactional `rr_manage_participant` RPC refuses the change if that player
 * is sitting in the CURRENT round's still-canonical match — it demands an
 * `activeMatchResolution` (finish the score, restart with the sub, or abandon
 * the match). This helper mirrors the RPC's own guard query
 * (see 20260716210000_slice2b_apply_external_plan.sql, the v_active_match
 * SELECT) so the UI can detect that situation up front and collect the
 * resolution BEFORE calling the RPC — turning a dead-end toast into a guided
 * choice.
 *
 * "Canonical" mirrors the DB exactly: the current round, not a bye, not voided,
 * not superseded by a later row. Score is NOT part of the match-detection
 * filter (a scored-but-not-yet-closed current-round match still counts as
 * live); instead we report `isScored` so the caller can offer the right
 * resolutions ("keep the result" only makes sense once a score exists).
 */

export interface LiveMatchRow {
  id: string;
  round_no: number;
  court_no: number;
  is_bye?: boolean | null;
  voided_at?: string | null;
  superseded_by_schedule_id?: string | null;
  team1_score?: number | null;
  team2_score?: number | null;
  a1_player_id?: string | null;
  a2_player_id?: string | null;
  b1_player_id?: string | null;
  b2_player_id?: string | null;
  a1_guest_id?: string | null;
  a2_guest_id?: string | null;
  b1_guest_id?: string | null;
  b2_guest_id?: string | null;
}

/** Identity of the roster member being removed / substituted out. */
export interface ParticipantIdentity {
  playerId?: string | null;
  guestPlayerId?: string | null;
}

export interface LiveMatchInfo {
  match: LiveMatchRow;
  /** True when both team scores are already recorded on the live match. */
  isScored: boolean;
}

function rowHoldsIdentity(row: LiveMatchRow, identity: ParticipantIdentity): boolean {
  const pid = identity.playerId ?? null;
  const gid = identity.guestPlayerId ?? null;
  if (pid) {
    if (
      row.a1_player_id === pid ||
      row.a2_player_id === pid ||
      row.b1_player_id === pid ||
      row.b2_player_id === pid
    ) {
      return true;
    }
  }
  if (gid) {
    if (
      row.a1_guest_id === gid ||
      row.a2_guest_id === gid ||
      row.b1_guest_id === gid ||
      row.b2_guest_id === gid
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Find the live (current-round, canonical, non-bye) match that the given
 * participant is seated in, or null when they aren't in one — in which case a
 * remove/substitute needs no active-match resolution and can proceed directly.
 *
 * A participant with neither a `playerId` nor a `guestPlayerId` can't be
 * matched to any seat, so this returns null (the caller should treat that as
 * "not in a live match").
 */
export function findParticipantLiveMatch(
  schedule: LiveMatchRow[],
  currentRound: number | null | undefined,
  identity: ParticipantIdentity,
): LiveMatchInfo | null {
  const round = currentRound ?? 1;
  if (!identity.playerId && !identity.guestPlayerId) return null;

  for (const row of schedule) {
    if (row.round_no !== round) continue;
    if (row.is_bye === true) continue;
    if (row.voided_at != null) continue;
    if (row.superseded_by_schedule_id != null) continue;
    if (!rowHoldsIdentity(row, identity)) continue;

    return {
      match: row,
      isScored: row.team1_score != null && row.team2_score != null,
    };
  }
  return null;
}

export type ActiveMatchResolutionKind =
  | "finish_and_record"
  | "restart_with_substitute"
  | "abandon";
