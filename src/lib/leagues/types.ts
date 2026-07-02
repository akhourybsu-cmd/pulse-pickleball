/**
 * League Management types.
 *
 * Kept intentionally hand-written (not from types.ts) so this module is
 * self-contained until Lovable regenerates the DB types. When
 * regeneration lands, we can either delete this file and pull from
 * `Database["public"]["Tables"]["leagues"]["Row"]` etc., or keep this
 * as the narrow view we actually use.
 */

export type LeagueStatus = "draft" | "active" | "archived";
export type LeagueVisibility = "admin_only" | "private" | "public_future";
export type LeagueType = "singles" | "doubles" | "team" | "flex" | "ladder";
export type SeasonStatus = "draft" | "active" | "completed" | "archived";
export type DivisionStatus = "active" | "archived";
export type MemberRole = "player" | "captain" | "manager";
export type MemberStatus = "active" | "pending" | "removed";
export type TeamStatus = "active" | "archived";
export type TeamMemberRole = "player" | "captain" | "substitute";
export type TeamMemberStatus = "active" | "removed";
export type SessionStatus = "draft" | "published" | "completed" | "canceled";
export type LeagueMatchStatus =
  | "scheduled"
  | "in_progress"
  | "score_submitted"
  | "verified"
  | "disputed"
  | "canceled"
  | "forfeit";
export type LeagueMatchRatingStatus =
  | "not_connected"
  | "not_eligible"
  | "eligible_future";

export interface League {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  community_id: string | null;
  created_by: string;
  status: LeagueStatus;
  visibility: LeagueVisibility;
  league_type: LeagueType;
  rating_eligible: boolean;
  guests_allowed: boolean;
  created_at: string;
  updated_at: string;
}

export interface LeagueSeason {
  id: string;
  league_id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  registration_deadline: string | null;
  status: SeasonStatus;
  created_at: string;
  updated_at: string;
}

export interface LeagueDivision {
  id: string;
  league_id: string;
  season_id: string;
  name: string;
  skill_min: number | null;
  skill_max: number | null;
  description: string | null;
  status: DivisionStatus;
  created_at: string;
  updated_at: string;
}

export interface LeagueMember {
  id: string;
  league_id: string;
  season_id: string | null;
  division_id: string | null;
  user_id: string;
  role: MemberRole;
  status: MemberStatus;
  joined_at: string;
  created_at: string;
  updated_at: string;
}

export interface LeagueTeam {
  id: string;
  league_id: string;
  season_id: string;
  division_id: string | null;
  name: string;
  captain_user_id: string | null;
  status: TeamStatus;
  created_at: string;
  updated_at: string;
}

export interface LeagueTeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: TeamMemberRole;
  status: TeamMemberStatus;
  created_at: string;
  updated_at: string;
}

export interface LeagueSession {
  id: string;
  league_id: string;
  season_id: string;
  division_id: string | null;
  name: string;
  scheduled_date: string | null;
  start_time: string | null;
  end_time: string | null;
  court_count: number | null;
  location: string | null;
  status: SessionStatus;
  created_at: string;
  updated_at: string;
}

export interface LeagueMatch {
  id: string;
  league_id: string;
  season_id: string;
  division_id: string | null;
  session_id: string | null;
  court_number: number | null;
  scheduled_time: string | null;
  team_a_id: string | null;
  team_b_id: string | null;
  player_a_id: string | null;
  player_b_id: string | null;
  player_c_id: string | null;
  player_d_id: string | null;
  linked_match_id: string | null;
  status: LeagueMatchStatus;
  rating_status: LeagueMatchRatingStatus;
  team_a_score: number | null;
  team_b_score: number | null;
  created_at: string;
  updated_at: string;
}

export interface LeagueAuditEntry {
  id: string;
  league_id: string | null;
  season_id: string | null;
  actor_user_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  created_at: string;
}
