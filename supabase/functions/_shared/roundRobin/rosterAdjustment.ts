import { seatsOf, type CoreMatch, type SeatId } from "./scheduleCore.ts";
import { planScheduleAdjustment, type ScheduleAdjustmentInput } from "./scheduleAdjustment.ts";

export interface RosterAdjustment {
  outgoingSeatId: SeatId;
  incomingSeatId?: SeatId;
  includeCurrent?: boolean;
  resolution?: "keep_current" | "abandon";
  allowBalanced?: boolean;
}

export interface RosterMatch extends CoreMatch {
  locked_at?: string | null;
  match_id?: string | null;
  team1_score?: number | null;
  team2_score?: number | null;
  abandoned?: boolean | null;
}

/** Project an explicit roster command before planning. Persistence repeats all
 * checks under lock, and commits this projection and future rounds together. */
export function projectRosterAdjustment(
  activeSeats: SeatId[], matches: RosterMatch[], currentRound: number,
  change: RosterAdjustment,
) {
  if (!change || typeof change !== "object" ||
      (change.includeCurrent != null && typeof change.includeCurrent !== "boolean") ||
      (change.allowBalanced != null && typeof change.allowBalanced !== "boolean")) {
    throw new Error("Invalid roster adjustment options.");
  }
  const seatPattern = /^[pg]:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const outgoing = change.outgoingSeatId, incoming = change.incomingSeatId;
  if (!seatPattern.test(outgoing) || !activeSeats.includes(outgoing) ||
      (incoming != null && (!seatPattern.test(incoming) || incoming === outgoing))) {
    throw new Error("Choose an active outgoing player and a different saved replacement.");
  }
  if (change.resolution && change.resolution !== "keep_current" && change.resolution !== "abandon") {
    throw new Error("Choose whether to keep the current match or abandon it.");
  }
  const current = matches.filter(m => m.round_no === currentRound && !m.is_bye && seatsOf(m).includes(outgoing));
  if (current.length > 1) throw new Error("This player has multiple current matches. Repair the schedule first.");
  const projected = matches.map(m => ({ ...m }));
  const protectedMatch = (m: RosterMatch) => m.locked_at != null || m.match_id != null ||
    m.team1_score != null || m.team2_score != null || m.abandoned;
  if (change.includeCurrent) {
    if (!incoming || current.length !== 1) throw new Error("Choose a player with a match in the current live round.");
    if (protectedMatch(current[0])) throw new Error("This match already has a score or is locked. Use Future rounds only to preserve it.");
    if (matches.some(m => m.round_no === currentRound && !m.is_bye && seatsOf(m).includes(incoming))) {
      throw new Error("The replacement is already playing in this round. Choose a resting player or a new arrival.");
    }
    for (const m of projected.filter(m => m.round_no === currentRound)) {
      for (const slot of ["a1", "a2", "b1", "b2"] as const) {
        if (m[slot] === outgoing && !m.is_bye) m[slot] = incoming;
        else if (m[slot] === incoming && m.is_bye) m[slot] = outgoing;
      }
    }
  } else if (!incoming && change.resolution === "abandon" && current[0]) {
    if (protectedMatch(current[0])) throw new Error("Saved or locked results cannot be discarded by a roster change. Keep this match instead.");
    const target = projected.find(m => m.round_no === currentRound && !m.is_bye && seatsOf(m).includes(outgoing));
    if (target) target.abandoned = true;
  }
  return {
    nextSeatIds: [...new Set(activeSeats.filter(s => s !== outgoing).concat(incoming ? [incoming] : []))].sort(),
    matches: projected.filter(m => !m.abandoned),
    substitution: incoming && !activeSeats.includes(incoming)
      ? { outgoingSeatId: outgoing, incomingSeatId: incoming } : null,
  };
}

/** A departure can make exact totals mathematically impossible. Only relax
 * that constraint when the host explicitly opted in, and report the change. */
export function planWithRosterFallback(input: ScheduleAdjustmentInput, allowBalanced = false) {
  const plan = planScheduleAdjustment(input);
  if (plan.ok || !input.equalGames || !allowBalanced || plan.code !== "equal_games_unavailable") return plan;
  const balanced = planScheduleAdjustment({ ...input, equalGames: false });
  if (balanced.ok) balanced.warnings.push({ code: "equal_games_relaxed", severity: "warning",
    message: "Equal totals are no longer possible with the departures and saved results. Remaining games were balanced with your permission; this event now uses balanced games." });
  return balanced;
}
