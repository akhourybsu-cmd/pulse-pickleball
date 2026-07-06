import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface LeagueCreationCapacity {
  owned: number;
  maxLeagues: number;
  remaining: number;
  isAdmin: boolean;
}

/**
 * Reads the caller's league-creation capacity from the server.
 * Backed by the `get_league_creation_capacity()` SQL function which
 * consolidates (owned count) + (1 + purchased slots) + (admin bypass)
 * into one row. Client should not derive this locally — the server
 * is the source of truth for the freemium gate.
 *
 * Returns a `refetch()` so the CreateLeagueDialog can refresh after
 * a slot purchase completes.
 */
export function useLeagueCreationCapacity() {
  const [capacity, setCapacity] = useState<LeagueCreationCapacity | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .rpc("get_league_creation_capacity" as never);
    if (error) {
      console.error("get_league_creation_capacity failed", error);
      setCapacity(null);
    } else {
      const row = (data as unknown as Array<{
        owned: number;
        max_leagues: number;
        remaining: number;
        is_admin: boolean;
      }>)[0];
      if (row) {
        setCapacity({
          owned: row.owned,
          maxLeagues: row.max_leagues,
          remaining: row.remaining,
          isAdmin: row.is_admin,
        });
      } else {
        setCapacity(null);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  return { capacity, loading, refetch: load };
}
