/**
 * usePlayerPulse — fetches the data behind the /player/pulse analytics screen
 * and runs it through the pure compute layer (lib/playerPulse.ts).
 *
 * One round trip: a single match_participants query joined to matches,
 * narrowed to this player's approved, non-voided, rating-eligible rows. No
 * per-match fan-out (the N+1 pattern MatchHistory uses is unnecessary here —
 * Pulse doesn't render opponent names in the MVP, only the player's own
 * rating movement and scores).
 *
 * The rating engine is never invoked; we only read the rating_before/after/
 * change snapshots it already wrote.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  buildPlayerPulse,
  type PlayerPulse,
  type PulseMatchRow,
} from "@/lib/playerPulse";

async function fetchPlayerPulse(playerId: string): Promise<PlayerPulse> {
  // Player's own participation rows + the parent match. inner join +
  // status/voided filters mirror MatchHistory's verified-history query so
  // Pulse and the match list always agree on what "counts".
  const { data, error } = await supabase
    .from("match_participants")
    .select(
      `
        match_id,
        team,
        rating_before,
        rating_after,
        rating_change,
        matches!inner(
          match_date,
          created_at,
          team1_score,
          team2_score,
          status,
          voided,
          source
        )
      `,
    )
    .eq("player_id", playerId)
    .eq("matches.status", "approved")
    .not("matches.voided", "is", true);

  if (error) throw error;

  const rows: PulseMatchRow[] = (data ?? [])
    .filter((r: any) => r.matches)
    .map((r: any) => ({
      matchId: r.match_id,
      matchDate: r.matches.match_date,
      createdAt: r.matches.created_at,
      team: r.team as 1 | 2,
      team1Score: r.matches.team1_score ?? 0,
      team2Score: r.matches.team2_score ?? 0,
      ratingBefore: r.rating_before,
      ratingAfter: r.rating_after,
      ratingChange: r.rating_change,
      source: r.matches.source ?? null,
    }));

  // Profile snapshot for the headline rating + aggregate fallbacks.
  const { data: profile } = await supabase
    .from("profiles")
    .select("current_rating, total_matches, wins, losses")
    .eq("id", playerId)
    .maybeSingle();

  return buildPlayerPulse(
    rows,
    {
      currentRating: profile?.current_rating ?? null,
      totalMatches: profile?.total_matches ?? null,
      wins: profile?.wins ?? null,
      losses: profile?.losses ?? null,
    },
    Date.now(),
  );
}

export function usePlayerPulse(playerId: string | undefined) {
  return useQuery({
    queryKey: ["player-pulse", playerId],
    queryFn: () => fetchPlayerPulse(playerId!),
    enabled: !!playerId,
    staleTime: 60_000,
  });
}
