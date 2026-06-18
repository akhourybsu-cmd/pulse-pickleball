import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface RecentCoPlayer {
  id: string;
  full_name: string;
  display_name: string | null;
  avatar_url: string | null;
  current_rating: number | null;
  gender: string | null;
  last_played_at: string;
}

/**
 * Players the current user has organized RRs with recently.
 * Used by the RR wizard player-picker "Recent" tab so organizers
 * can re-add the same crew without typing names.
 */
export function useRecentCoPlayers() {
  return useQuery({
    queryKey: ["recent-co-players"],
    queryFn: async (): Promise<RecentCoPlayer[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Recent RR events I organized
      const { data: events } = await supabase
        .from("round_robin_events")
        .select("id, created_at")
        .eq("organizer_id", user.id)
        .order("created_at", { ascending: false })
        .limit(15);

      if (!events || events.length === 0) return [];
      const eventIds = events.map((e) => e.id);
      const eventDate = new Map(events.map((e) => [e.id, e.created_at]));

      const { data: players } = await supabase
        .from("round_robin_players")
        .select("player_id, event_id")
        .in("event_id", eventIds)
        .not("player_id", "is", null);

      if (!players || players.length === 0) return [];

      // Dedup, keep most recent
      const lastSeen = new Map<string, string>();
      for (const p of players) {
        if (!p.player_id || p.player_id === user.id) continue;
        const when = eventDate.get(p.event_id) ?? "";
        const prev = lastSeen.get(p.player_id);
        if (!prev || when > prev) lastSeen.set(p.player_id, when);
      }
      const ids = [...lastSeen.keys()];
      if (ids.length === 0) return [];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, display_name, avatar_url, current_rating, gender")
        .in("id", ids);

      return (profiles || [])
        .map((p) => ({
          ...p,
          last_played_at: lastSeen.get(p.id) ?? "",
        }))
        .sort((a, b) => (a.last_played_at < b.last_played_at ? 1 : -1));
    },
    staleTime: 60_000,
  });
}
