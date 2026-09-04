import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { LeagueType, LeagueMatchStatus } from "@/lib/leagues/types";
import { useAuthState } from "@/hooks/useAuthState";

export interface UpcomingLeagueMatch {
  match_id: string;
  league_id: string;
  league_name: string;
  league_type: LeagueType;
  season_id: string | null;
  season_name: string | null;
  scheduled_time: string;
  court_number: number | null;
  location: string | null;
  status: LeagueMatchStatus;
  team_a_id: string | null;
  team_a_name: string | null;
  team_b_id: string | null;
  team_b_name: string | null;
}

/**
 * One-round-trip fetch of the caller's next N upcoming league matches
 * across every league. Backs the Dashboard "Up next in leagues" card.
 * Server-side filters admin_only leagues + past times.
 *
 * Error is propagated (not silently swallowed) so the wrapping
 * section can hide-on-empty vs. show-a-real-message when the RPC
 * actually failed. The console.error keeps the failure visible in
 * dev without crashing the Dashboard.
 */
export function useMyUpcomingLeagueMatches(limit = 3) {
  const { user } = useAuthState();
  const query = useQuery({
    queryKey: ["my-upcoming-league-matches", user?.id, limit],
    enabled: Boolean(user),
    staleTime: 2 * 60 * 1000,
    queryFn: async (): Promise<UpcomingLeagueMatch[]> => {
      const { data, error: rpcErr } = await supabase
        .rpc("get_my_upcoming_league_matches" as never, { p_limit: limit } as never);
      if (rpcErr) {
        console.error("get_my_upcoming_league_matches failed", rpcErr);
        throw rpcErr;
      }
      return (data ?? []) as unknown as UpcomingLeagueMatch[];
    },
  });

  return {
    rows: query.data ?? [],
    loading: Boolean(user) && query.isPending,
    error: query.error instanceof Error ? query.error.message : null,
  };
}
