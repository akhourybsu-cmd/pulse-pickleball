import { getErrorCode, getErrorMessage } from "@/lib/getErrorMessage";
import type { LiveMatchRow, ParticipantIdentity } from "./activeMatch";

export function roundRobinEditError(error: unknown): string {
  const message = getErrorMessage(error, "");
  const code = getErrorCode(error) ?? "";
  const text = `${code} ${message}`;
  if (/RR_STALE_VERSION|40001|changed.*(elsewhere|session)|schedule changed/i.test(text)) {
    return "The event changed while you were editing. Choose Review latest, then select the players or matches again before saving.";
  }
  if (/equal_games_unavailable|equal (games|totals).*impossible|exact.*totals/i.test(text)) {
    return "Equal game totals are no longer possible. Choose Review latest, reselect the players, and enable ‘Allow balanced games’. For a schedule repair, open Courts & games and turn off Equal games.";
  }
  if (/insufficient_players/i.test(text)) {
    return "Keep at least four eligible players. Choose a replacement instead of a removal, or add players in Manage players before rebuilding. Choose Review latest before retrying.";
  }
  if (/mixed_roster_gender_missing|mixed_roster_unplayable|gender_format_mismatch/i.test(text)) {
    return "The selected roster does not meet this event's format. Mixed doubles needs at least two men and two women with saved gender details. For a men's or women's event, choose an eligible replacement. Choose Review latest before retrying.";
  }
  if (/RR_PROTECTED_ROUND|already.*(scored|locked)|protected play/i.test(text)) {
    return "This match or round is protected. Review latest, then use Future rounds only for a replacement or choose an unplayed future round to edit. To correct a saved score, open Manage scores.";
  }
  if (/RR_EVENT_CLOSED|event is (closed|completed|voided)|schedule is locked/i.test(text)) {
    return "This event is closed. Player and schedule changes are disabled. For a completed event's score correction, open Manage scores; create a new event for more play.";
  }
  if (/RR_UNAUTHORIZED|42501|not authorized|sign in|unauthorized/i.test(text)) {
    return "Your permission to edit could not be verified. Sign in with the host account and complete any verification, then reopen this event.";
  }
  if (/already (playing|assigned)|replacement.*on court/i.test(text)) {
    return "The replacement is already playing in this round. Choose a resting player or a new arrival, or use Future rounds only.";
  }
  if (/RR_INVALID_SUBSTITUTE|RR_INVALID_ROSTER|RR_INVALID_PLAN|RR_INVALID_FORMAT/.test(text)) {
    const detail = message.replace(/^RR_[A-Z_]+:?\s*/, "");
    return `${detail || "That change is not valid for the current schedule."} Review latest, then choose a valid player or an unplayed future round.`;
  }
  if (/network|fetch|connection|timeout|timed out|not confirmed|non-2xx/i.test(text) || !message || /RR_|SQL|constraint|relation|schema/i.test(message)) {
    return "The change could not be confirmed. Choose Review latest and check whether it already saved before trying again. Your selections are kept until you review.";
  }
  return `${message} Choose Review latest, then adjust your selection or event format before trying again.`;
}

export type SubstituteScope = "global" | "current_future" | number;
type EditableMatch = LiveMatchRow & { locked_at?: string | null; match_id?: string | null; abandoned?: boolean | null };
const holds = (row: LiveMatchRow, who: ParticipantIdentity) =>
  ["a1", "a2", "b1", "b2"].some(slot =>
    (who.playerId && row[`${slot}_player_id` as keyof LiveMatchRow] === who.playerId) ||
    (who.guestPlayerId && row[`${slot}_guest_id` as keyof LiveMatchRow] === who.guestPlayerId));

/** Explain unsafe choices before submitting; the versioned server checks remain authoritative. */
export function substitutionIssue({ schedule, status, currentRound, scope, original, replacement }: {
  schedule: EditableMatch[];
  status: string;
  currentRound: number | null;
  scope: SubstituteScope;
  original: ParticipantIdentity | null;
  replacement: ParticipantIdentity | null;
}): string | null {
  if (status === "completed" || status === "voided") return "This event is closed. Start a new event to change the playing roster.";
  if (scope !== "global" && (status !== "live" || currentRound == null || (typeof scope === "number" && scope !== currentRound))) {
    return "The live round changed. Choose when the replacement takes effect again; no future-round replacement will be applied automatically.";
  }
  if (!original || !replacement) return null;
  if ((original.playerId && original.playerId === replacement.playerId) || (original.guestPlayerId && original.guestPlayerId === replacement.guestPlayerId)) {
    return "Choose a different player as the replacement.";
  }
  if (scope === "global") return null;
  const current = schedule.filter(row => row.round_no === currentRound && !row.is_bye && row.voided_at == null && row.superseded_by_schedule_id == null);
  const matches = current.filter(row => holds(row, original));
  if (matches.length !== 1) return "The outgoing player needs one current court assignment. Choose an on-court player, or use Future rounds only for a roster change.";
  const match = matches[0];
  if (match.team1_score != null || match.team2_score != null || match.locked_at != null || match.match_id != null || match.abandoned) {
    return "This player's current match has a saved result or is locked. Choose Future rounds only to keep that match intact.";
  }
  if (current.some(row => holds(row, replacement))) return "The replacement is already on court. Choose a resting player or a new arrival, or use Future rounds only.";
  return null;
}
