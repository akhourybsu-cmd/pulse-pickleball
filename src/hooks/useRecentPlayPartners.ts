import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthState } from "@/hooks/useAuthState";

export interface RecentPlayPartner {
  id: string;
  display_name: string | null;
  full_name: string | null;
  avatar_url: string | null;
  current_rating: number | null;
  handle: string | null;
  reason: string;
  last_played_at: string | null;
}

export type RecentStatus = "idle" | "loading" | "ready" | "unavailable";

/**
 * People the signed-in player has recently shared a match or round robin with
 * and is not already connected to. Ordered most-recent first by the
 * `recent_play_partners` SECURITY DEFINER RPC.
 *
 * Degrades to `unavailable` (never throws) if the RPC isn't deployed yet, so
 * the surrounding Connect menu keeps working.
 */
export function useRecentPlayPartners(active: boolean, limit = 24) {
  const { user } = useAuthState();
  const query = useQuery({
    queryKey: ["recent-play-partners", user?.id, limit],
    enabled: active && !!user,
    staleTime: 60_000,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase
        .rpc("recent_play_partners", {
          _limit: limit,
        })
        .abortSignal(signal);
      if (error) throw error;
      return (data ?? []) as RecentPlayPartner[];
    },
  });
  const status: RecentStatus =
    !active || !user
      ? "idle"
      : query.isPending
      ? "loading"
      : query.isError
      ? "unavailable"
      : "ready";
  return { players: query.data ?? [], status, refetch: query.refetch };
}
