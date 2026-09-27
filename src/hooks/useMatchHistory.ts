import { useEffect, useId } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { loadMatchHistory } from "@/lib/loadMatchHistory";

export function useMatchHistory(
  playerId: string | null,
  viewerId: string | null
) {
  const client = useQueryClient();
  const channelId = useId();
  const query = useQuery({
    // Account and subject are both part of the cache key. Never carry a previous player's data forward.
    queryKey: ["match-history", playerId, viewerId],
    enabled: !!playerId && !!viewerId,
    staleTime: 30_000,
    retry: 1,
    queryFn: async ({ signal }) => {
      const controller = new AbortController();
      const abort = () => controller.abort();
      signal.addEventListener("abort", abort, { once: true });
      if (signal.aborted) abort();
      const timeout = setTimeout(abort, 30_000);
      try {
        return await loadMatchHistory(
          playerId!,
          playerId === viewerId,
          controller.signal
        );
      } finally {
        clearTimeout(timeout);
        signal.removeEventListener("abort", abort);
      }
    },
  });
  useEffect(() => {
    if (!playerId || !viewerId) return;
    const refresh = () => {
      void client.invalidateQueries({
        queryKey: ["match-history", playerId, viewerId],
      });
    };
    const ids = new Set(
      [
        ...(query.data?.matches || []),
        ...(query.data?.pendingMatches || []),
      ].map((match) => match.match_id)
    );
    const channel = supabase
      .channel(`match-history:${channelId}:${playerId}:${viewerId}`)
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
        { event: "*", schema: "public", table: "matches" },
        (payload) => {
          const row = payload.new as { id?: string };
          const old = payload.old as { id?: string };
          if (ids.has(row.id || old.id || "")) refresh();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "match_approvals" },
        (payload) => {
          const row = payload.new as { match_id?: string };
          const old = payload.old as { match_id?: string };
          if (ids.has(row.match_id || old.match_id || "")) refresh();
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [channelId, client, playerId, viewerId, query.data]);
  return query;
}
