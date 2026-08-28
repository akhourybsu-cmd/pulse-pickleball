/**
 * Slice 4 — canonical client-side rule for which schedule rows count toward
 * standings / stats / ratings.
 *
 * This mirrors the `round_robin_schedule_counted` DB view added in Slice 2a:
 * a row contributes ONLY if it is a real, played, still-canonical match —
 * not a bye, not voided, not superseded by a later row, not abandoned, and
 * with both final scores recorded.
 *
 * Before Slice 4 the client standings/kiosk/player views counted any scored
 * non-bye row, so an abandoned or superseded match (produced by participant
 * management — withdraw/abandon, restart-with-substitute, or a reoptimize that
 * voids stale rows) would wrongly keep contributing. This helper closes that
 * gap everywhere it is applied.
 *
 * Safe-by-construction: the guard fields are optional, so on a query that does
 * not select `voided_at` / `superseded_by_schedule_id` / `abandoned`, those
 * checks see `undefined` (falsy) and the row is treated exactly as before —
 * applying this helper can never change behaviour for a reader that lacks the
 * columns, only correct it for one that has them.
 */

export interface CountableScheduleRow {
  is_bye?: boolean | null;
  team1_score?: number | null;
  team2_score?: number | null;
  voided_at?: string | null;
  superseded_by_schedule_id?: string | null;
  abandoned?: boolean | null;
}

/** True when a schedule row's result should count toward standings/stats. */
export function countsTowardScore(row: CountableScheduleRow): boolean {
  return (
    row.is_bye !== true &&
    row.voided_at == null &&
    row.superseded_by_schedule_id == null &&
    row.abandoned !== true &&
    row.team1_score != null &&
    row.team2_score != null
  );
}

/* ------------------------------------------------------------------------- *
 * Canonical standings computation
 *
 * Previously the organizer page, the kiosk display, and the player view each
 * implemented their own standings math with DIFFERENT tie-breaks and different
 * handling of removed/withdrawn players, so the same event could rank players
 * three different ways depending on where you looked. This is the single
 * source of truth; each view maps the canonical rows into its own shape.
 *
 * Ordering: active players first (wins ↓, point diff ↓, points for ↓, name ↑),
 * then removed/withdrawn players (same ordering among themselves) pinned to the
 * bottom and flagged `isRemoved`.
 * ------------------------------------------------------------------------- */

export interface StandingsSeatRow extends CountableScheduleRow {
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

export interface StandingsParticipant {
  /** profile uuid, or guest_player uuid for guests */
  key: string;
  name: string;
  /** false for withdrawn / removed participants */
  active?: boolean;
}

export interface CanonicalStandingsRow {
  key: string;
  name: string;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
  gamesPlayed: number;
  isRemoved: boolean;
}

/** Display label for a guest seat: "(G)" suffix unless linked to a real user. */
export function guestSeatLabel(
  guest?: { display_name?: string | null; linked_user_id?: string | null } | null,
  fallbackName?: string | null,
): string {
  const name = guest?.display_name || fallbackName || "Guest";
  return guest?.linked_user_id ? name : `${name} (G)`;
}

export function computeStandings(
  schedule: StandingsSeatRow[],
  participants: StandingsParticipant[],
): CanonicalStandingsRow[] {
  const stats = new Map<string, CanonicalStandingsRow>();
  for (const p of participants) {
    if (!p.key || stats.has(p.key)) continue;
    stats.set(p.key, {
      key: p.key,
      name: p.name,
      wins: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      pointDiff: 0,
      gamesPlayed: 0,
      isRemoved: p.active === false,
    });
  }

  for (const match of schedule) {
    if (!countsTowardScore(match)) continue;
    const t1 = match.team1_score as number;
    const t2 = match.team2_score as number;
    const teamA = [
      match.a1_player_id ?? match.a1_guest_id,
      match.a2_player_id ?? match.a2_guest_id,
    ].filter((v): v is string => !!v);
    const teamB = [
      match.b1_player_id ?? match.b1_guest_id,
      match.b2_player_id ?? match.b2_guest_id,
    ].filter((v): v is string => !!v);
    const team1Won = t1 > t2;

    const credit = (ids: string[], forPts: number, againstPts: number, won: boolean) => {
      for (const id of ids) {
        const row = stats.get(id);
        if (!row) continue;
        row.gamesPlayed += 1;
        row.pointsFor += forPts;
        row.pointsAgainst += againstPts;
        if (won) row.wins += 1;
        else row.losses += 1;
      }
    };
    credit(teamA, t1, t2, team1Won);
    credit(teamB, t2, t1, !team1Won);
  }

  const rows = Array.from(stats.values()).map((r) => ({
    ...r,
    pointDiff: r.pointsFor - r.pointsAgainst,
  }));

  const byRank = (a: CanonicalStandingsRow, b: CanonicalStandingsRow) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.pointDiff !== a.pointDiff) return b.pointDiff - a.pointDiff;
    if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
    return a.name.localeCompare(b.name);
  };

  return [
    ...rows.filter((r) => !r.isRemoved).sort(byRank),
    ...rows.filter((r) => r.isRemoved).sort(byRank),
  ];
}

/**
 * Derive the participant list from schedule seats alone. Used by readers (the
 * kiosk) that never load the roster table. Removed players cannot be detected
 * this way, so callers with roster access should pass real participants.
 */
export function participantsFromSchedule(
  schedule: (StandingsSeatRow & Record<string, unknown>)[],
): StandingsParticipant[] {
  const found = new Map<string, string>();
  const seats: [string, string, string][] = [
    ["a1_player_id", "a1_profile", "a1_guest"],
    ["a2_player_id", "a2_profile", "a2_guest"],
    ["b1_player_id", "b1_profile", "b1_guest"],
    ["b2_player_id", "b2_profile", "b2_guest"],
  ];
  for (const match of schedule) {
    for (const [pidKey, profKey, guestKey] of seats) {
      const pid = match[pidKey] as string | null | undefined;
      const guestId = match[pidKey.replace("_player_id", "_guest_id")] as string | null | undefined;
      if (pid) {
        const prof = match[profKey] as { display_name?: string | null; full_name?: string | null } | null;
        const name = prof?.display_name || prof?.full_name || "Unknown";
        if (!found.has(pid) || found.get(pid) === "Unknown") found.set(pid, name);
      } else if (guestId) {
        const guest = match[guestKey] as { display_name?: string | null; linked_user_id?: string | null } | null;
        const name = guestSeatLabel(guest);
        if (!found.has(guestId) || found.get(guestId)?.startsWith("Guest")) found.set(guestId, name);
      }
    }
  }
  return Array.from(found.entries()).map(([key, name]) => ({ key, name, active: true }));
}
