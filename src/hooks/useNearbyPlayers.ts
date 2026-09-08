import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthState } from "@/hooks/useAuthState";

export interface NearbyPlayer {
  id: string;
  display_name: string | null;
  full_name: string | null;
  avatar_url: string | null;
  current_rating: number | null;
  handle: string | null;
  location_name: string | null;
  distance_km: number;
  reason: string;
}

export type NearbyStatus =
  | "idle" // not fetched yet
  | "loading"
  | "ready" // fetched (players may be empty)
  | "not_enabled" // caller hasn't opted in / set a location
  | "unavailable"; // RPC not deployed or errored

/**
 * Distance-ranked friend discovery (opt-in, reciprocal). Reads the caller's own
 * discoverability + coordinates first so the UI can show the right prompt, then
 * calls the SECURITY DEFINER `discover_players_nearby` RPC (which itself gates
 * on the caller being discoverable).
 *
 * Degrades gracefully: if the RPC isn't deployed yet the status becomes
 * `unavailable` rather than throwing, so the surrounding menu never breaks.
 */
export function useNearbyPlayers(active: boolean, radiusKm = 40) {
  const { user } = useAuthState();
  const query = useQuery({
    queryKey: ["nearby-players", user?.id, radiusKm],
    enabled: active && !!user,
    staleTime: 60_000,
    queryFn: async ({ signal }) => {
      const { data: me, error: meErr } = await supabase
        .from("profiles")
        .select("discoverable_by_location, location_lat, location_name")
        .eq("id", user!.id)
        .abortSignal(signal)
        .maybeSingle();

      // Column missing (migration not deployed) surfaces as an error here.
      if (meErr) throw meErr;

      const meRow = me as {
        discoverable_by_location?: boolean;
        location_lat?: number | null;
        location_name?: string | null;
      } | null;

      if (!meRow?.discoverable_by_location || meRow?.location_lat == null) {
        return {
          players: [] as NearbyPlayer[],
          status: "not_enabled" as const,
          selfLocationName: meRow?.location_name ?? null,
        };
      }

      const { data, error } = await supabase
        .rpc("discover_players_nearby", {
          _radius_km: radiusKm,
          _limit: 30,
        })
        .abortSignal(signal);
      if (error) throw error;
      return {
        players: (data ?? []) as NearbyPlayer[],
        status: "ready" as const,
        selfLocationName: meRow?.location_name ?? null,
      };
    },
  });
  const status: NearbyStatus = !active
    ? "idle"
    : !user
    ? "not_enabled"
    : query.isPending
    ? "loading"
    : query.isError
    ? "unavailable"
    : query.data.status;
  return {
    players: query.data?.players ?? [],
    status,
    selfLocationName: query.data?.selfLocationName ?? null,
    refetch: query.refetch,
  };
}
