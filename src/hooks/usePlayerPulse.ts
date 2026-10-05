import { useEffect, useId } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { withAuthDeadline } from "@/lib/authDeadline";
import { buildPlayerPulse, type PulseMatchRow } from "@/lib/playerPulse";

interface RawPulseRow {
  match_id: string;
  team: number;
  rating_before: number | null;
  rating_after: number | null;
  rating_change: number | null;
  matches: {
    match_date: string;
    created_at: string;
    team1_score: number | null;
    team2_score: number | null;
    status: string;
    voided: boolean | null;
    count_for_rating: boolean | null;
    source: string | null;
  } | null;
}
/** Read every ordered page. Never publish a truncated or failed batch as
 * "all time", and never issue per-match requests. */
export async function fetchPlayerPulse(playerId: string, signal: AbortSignal) {
  const loadMatches = async () => {
    const rows: PulseMatchRow[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabase
        .from("match_participants")
        .select(
          `match_id, team, rating_before, rating_after, rating_change,
          matches!inner(match_date, created_at, team1_score, team2_score, status, voided, count_for_rating, source)`
        )
        .eq("player_id", playerId)
        .eq("matches.status", "approved")
        .not("matches.voided", "is", true)
        .not("matches.count_for_rating", "is", false)
        .order("match_id")
        .order("id")
        .range(offset, offset + 499)
        .abortSignal(signal);
      if (error) throw error;
      for (const row of (data ?? []) as unknown as RawPulseRow[]) {
        const match = row.matches;
        if (
          !match ||
          match.status !== "approved" ||
          match.voided === true ||
          match.count_for_rating === false
        )
          continue;
        rows.push({
          matchId: row.match_id,
          matchDate: match.match_date,
          createdAt: match.created_at,
          team: row.team as 1 | 2,
          team1Score: match.team1_score,
          team2Score: match.team2_score,
          ratingBefore: row.rating_before,
          ratingAfter: row.rating_after,
          ratingChange: row.rating_change,
          source: match.source,
        });
      }
      if (!data || data.length < 500) break;
    }
    return rows;
  };
  const [rows, profile] = await Promise.all([
    loadMatches(),
    supabase
      .from("profiles")
      .select("current_rating")
      .eq("id", playerId)
      .abortSignal(signal)
      .single(),
  ]);
  if (profile.error) throw profile.error;
  if (!profile.data) throw new Error("Player profile is unavailable.");
  return buildPlayerPulse(
    rows,
    { currentRating: profile.data.current_rating },
    Date.now()
  );
}

export function usePlayerPulse(playerId: string | undefined) {
  const client = useQueryClient();
  const channelId = useId();
  const query = useQuery({
    // Version prevents old persisted analytics shapes from being restored.
    queryKey: ["player-pulse", playerId, "v2"],
    queryFn: ({ signal }) =>
      withAuthDeadline(async (deadline) => {
        const controller = new AbortController();
        const abort = () => controller.abort();
        signal.addEventListener("abort", abort, { once: true });
        deadline.addEventListener("abort", abort, { once: true });
        if (signal.aborted || deadline.aborted) abort();
        try {
          return await fetchPlayerPulse(playerId!, controller.signal);
        } finally {
          signal.removeEventListener("abort", abort);
          deadline.removeEventListener("abort", abort);
        }
      }, 30_000),
    enabled: !!playerId,
    staleTime: 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
  useEffect(() => {
    if (!playerId) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      // A replay can update many rows in one transaction; coalesce refreshes.
      timer = setTimeout(
        () =>
          void client.invalidateQueries({
            queryKey: ["player-pulse", playerId],
          }),
        350
      );
    };
    const ids = new Set(query.data?.matches.map((row) => row.matchId));
    const channel = supabase
      .channel(`player-pulse:${channelId}:${playerId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "match_participants",
          filter: `player_id=eq.${playerId}`,
        },
        refresh
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${playerId}`,
        },
        refresh
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "matches" },
        (payload) => {
          if (ids.has((payload.new as { id?: string }).id ?? "")) refresh();
        }
      )
      .subscribe();
    return () => {
      clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [playerId, client, channelId, query.data]);
  return query;
}
