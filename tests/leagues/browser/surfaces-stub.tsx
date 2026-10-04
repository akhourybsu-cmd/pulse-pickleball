/* Isolated display fixtures: no production network or mutations. */
import { useLocation, useNavigate } from "react-router-dom";
import { supabase as base, tables } from "./stub";
export { useAuthState, isSkillAssessmentEnabled } from "./stub";
export const league = tables.leagues[0];
league.name = "Courtside Autumn Individual Doubles Ladder";
league.league_type = "ladder";
league.branding = {
  primary_color: "#2563eb",
  secondary_color: "#172554",
  accent_color: "#67e8f9",
  logo_url: "/pulse-icon-192.png",
  cover_url: "/venues/rally-haus/facility-preview.png",
  logo_fit: "contain",
};
export function useMyLeagues() {
  const location = useLocation(),
    navigate = useNavigate();
  return {
    rows: [
      {
        league,
        season: tables.league_seasons[1],
        membership: { id: "member", role: "player" },
      },
    ],
    loading: false,
    error: location.pathname === "/errors" ? "Connection failed" : null,
    retry: () => navigate("/"),
  };
}
export function useMyUpcomingLeagueMatches() {
  const location = useLocation(),
    navigate = useNavigate();
  return {
    rows: [false, true].map((dateOnly, i) => ({
      match_id: `game-${i}`,
      league_id: "league",
      league_name: league.name,
      league_type: "ladder",
      season_id: "old",
      season_name: "Summer 2026 • Previous season",
      scheduled_time: null,
      has_match_time: false,
      session_date: "2027-02-01",
      session_start_time: dateOnly ? null : "18:30:00",
      court_number: 2,
      location: "North courts",
      team_a_name: "Charlotte Williams-Robertson & Blake",
      team_b_name: "Casey & Devon",
      league_branding: league.branding,
    })),
    loading: false,
    error: location.pathname === "/errors" ? "Connection failed" : null,
    retry: () => navigate("/"),
  };
}
export const supabase = {
  ...base,
  auth: {
    ...base.auth,
    getUser: async () => ({ data: { user: null }, error: null }),
  },
  rpc: (name: string, args?: { p_code?: string }) => {
    const result = Promise.resolve(name === "find_league_by_invite_code"
      ? {
          data:
            args?.p_code === "INVALID"
              ? []
              : [
                  {
                    ...league,
                    registration_open: true,
                    registration_closes_at: "2027-02-01",
                  },
                ],
          error: null,
        }
      : base.rpc(name));
    return Object.assign(result, { abortSignal: () => result });
  },
};
