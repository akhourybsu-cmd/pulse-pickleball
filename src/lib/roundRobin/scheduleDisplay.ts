import {
  countsTowardScore,
  resolvedMatchLabel,
  type StandingsSeatRow,
} from "./standings";

const seats = ["a1", "a2", "b1", "b2"] as const;
export type ScheduleSeat = (typeof seats)[number];
export function restingPlayers<T extends StandingsSeatRow>(matches: T[]) {
  const found = new Map<
    string,
    { id: string; match: T; seat: (typeof seats)[number] }
  >();
  for (const match of matches) {
    if (!match.is_bye || match.voided_at || match.superseded_by_schedule_id)
      continue;
    for (const seat of seats) {
      const id = match[`${seat}_player_id`] ?? match[`${seat}_guest_id`];
      if (id && !found.has(id)) found.set(id, { id, match, seat });
    }
  }
  return [...found.values()];
}

export function roundScheduleSummary(matches: StandingsSeatRow[]) {
  const current = matches.filter(
    (match) => !match.voided_at && !match.superseded_by_schedule_id
  );
  const courts = current.filter((match) => !match.is_bye);
  return {
    games: courts.length,
    scored: courts.filter(countsTowardScore).length,
    resolved: courts.filter((match) => match.abandoned).length,
    resting: restingPlayers(current).length,
  };
}

export function scheduleMatchLabel(
  match: StandingsSeatRow,
  round: number,
  currentRound: number,
  status: string
) {
  if (match.is_bye) return "Resting";
  const resolved = resolvedMatchLabel(match);
  if (resolved) return resolved;
  if (countsTowardScore(match)) return "Completed";
  if (status === "completed" || status === "voided") return "No result";
  if (
    seats.some(
      (seat) => !(match[`${seat}_player_id`] ?? match[`${seat}_guest_id`])
    )
  )
    return "Awaiting players";
  if (status === "draft") return "Planned";
  return round === currentRound
    ? "Awaiting score"
    : round < currentRound
    ? "No result"
    : "Upcoming";
}
