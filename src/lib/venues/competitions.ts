import type { LeagueBrand } from "@/lib/leagues/branding";
export interface VenueRoundRobin {
  id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  canceled_at: string | null;
  capacity: number | null;
  price_cents: number;
  games_per_player: number;
  skill_level_min: number | null;
  skill_level_max: number | null;
  rotation_style: string | null;
  round_robin_id: string | null;
  roster_locked_at: string | null;
  status: string | null;
  confirmed: number;
  playing: number;
  roster_additions: number;
  roster_withdrawals: number;
  courts: { id: string; name: string; court_number: number }[];
}
export interface VenueCompetitions {
  venue: { id: string; name: string; timezone: string | null };
  round_robins: VenueRoundRobin[];
  leagues: {
    id: string;
    name: string;
    status: string;
    league_type: string;
    branding?: LeagueBrand;
    seasons: number;
    members: number;
  }[];
  available_leagues: { id: string; name: string }[];
}
export function venueRoundRobinHref(groupId: string, id: string) {
  return `/player/community/group/${encodeURIComponent(groupId)}/competitions/round-robins/${id}`;
}
