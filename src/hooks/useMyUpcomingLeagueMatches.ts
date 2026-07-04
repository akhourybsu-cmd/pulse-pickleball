import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { LeagueType, LeagueMatchStatus } from "@/lib/leagues/types";

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
 */
export function useMyUpcomingLeagueMatches(limit = 3) {
  const [rows, setRows] = useState<UpcomingLeagueMatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .rpc("get_my_upcoming_league_matches" as never, { p_limit: limit } as never);
      if (!cancelled) {
        if (error) {
          setRows([]);
        } else {
          setRows((data ?? []) as unknown as UpcomingLeagueMatch[]);
        }
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [limit]);

  return { rows, loading };
}
