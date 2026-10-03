import { computeStandings, countsTowardScore, guestSeatLabel, type StandingsSeatRow } from './standings';

interface Profile {
  full_name?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  current_rating?: number | null;
}
interface Guest {
  display_name?: string | null;
  linked_user_id?: string | null;
}
export interface HydratedEventPlayer {
  id: string;
  player_id: string | null;
  guest_player_id: string | null;
  guest_name?: string | null;
  registration_status?: string | null;
  active: boolean;
  profiles: Profile | null;
  guest_players?: Guest | null;
}
const seats = ['a1', 'a2', 'b1', 'b2'] as const;
export type HydratedEventMatch = StandingsSeatRow & {
  id: string;
  round_no: number;
  court_no: number;
  is_bye: boolean;
  team1_score: number | null;
  team2_score: number | null;
} & Record<`${typeof seats[number]}_player_id` | `${typeof seats[number]}_guest_id`, string | null>
  & Partial<Record<`${typeof seats[number]}_profile`, Profile | null>>
  & Partial<Record<`${typeof seats[number]}_guest`, Guest | null>>;

interface ViewPlayer {
  id: string;
  player_id: string;
  registration_status: string;
  active: boolean;
  is_guest: boolean;
  guest_display_name: string | null;
  guest_linked_user_id: string | null;
  profiles: Profile | null;
}

/** Project the already-authorized, hydrated event read into the player UI.
 * No second fetch/subscription, and historical seats keep names after removal.
 */
export function buildPlayerEventSnapshot(roster: HydratedEventPlayer[], rows: HydratedEventMatch[]) {
  const byId = new Map<string, ViewPlayer>();
  for (const row of roster) {
    const id = row.player_id ?? row.guest_player_id;
    if (!id) continue;
    byId.set(id, {
      id: row.id, player_id: id, active: row.active !== false,
      registration_status: row.active !== false ? row.registration_status ?? 'confirmed' : '',
      is_guest: !!row.guest_player_id,
      guest_display_name: row.guest_players?.display_name || row.guest_name || null,
      guest_linked_user_id: row.guest_players?.linked_user_id ?? null,
      profiles: row.profiles,
    });
  }
  for (const match of rows) for (const seat of seats) {
    const id = match[`${seat}_player_id`] ?? match[`${seat}_guest_id`];
    if (!id || byId.has(id)) continue;
    const guest = match[`${seat}_guest`];
    byId.set(id, {
      id, player_id: id, active: false, registration_status: '',
      is_guest: !!match[`${seat}_guest_id`],
      guest_display_name: guest?.display_name ?? null,
      guest_linked_user_id: guest?.linked_user_id ?? null,
      profiles: match[`${seat}_profile`] ?? null,
    });
  }
  const players = [...byId.values()];
  const schedule = rows.map(match => ({
    ...match,
    team_a_score: match.team1_score,
    team_b_score: match.team2_score,
    completed: countsTowardScore(match),
  }));
  const standings = computeStandings(rows, players.map(player => ({
    key: player.player_id, active: player.active,
    name: player.profiles?.display_name || player.profiles?.full_name ||
      (player.is_guest ? guestSeatLabel({ display_name: player.guest_display_name, linked_user_id: player.guest_linked_user_id }) : 'Someone'),
  }))).map(row => ({
    playerId: row.key, playerName: row.name, wins: row.wins, losses: row.losses,
    pointsFor: row.pointsFor, pointsAgainst: row.pointsAgainst,
    gamesPlayed: row.gamesPlayed, isRemoved: row.isRemoved,
  }));
  const groupedSchedule: Record<number, typeof schedule> = {};
  for (const match of schedule) (groupedSchedule[match.round_no] ??= []).push(match);
  return { players, byId, schedule, standings, groupedSchedule };
}
