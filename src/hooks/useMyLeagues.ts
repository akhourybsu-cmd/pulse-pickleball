import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type {
  League, LeagueMember, LeagueSeason, LeagueDivision,
} from "@/lib/leagues/types";

export interface MyLeagueRow {
  league: League;
  membership: LeagueMember;
  season: LeagueSeason | null;
  division: LeagueDivision | null;
}

/**
 * Reads the current player's active league memberships. RLS on the
 * server side already enforces:
 *   - user_id = auth.uid()
 *   - league.visibility != 'admin_only'
 * So this hook can select naively and trust Postgres to hide anything
 * the player shouldn't see.
 */
export function useMyLeagues() {
  const [rows, setRows] = useState<MyLeagueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) { setRows([]); setLoading(false); }
        return;
      }

      // 1. Active memberships for the current player.
      const { data: memberships, error: memErr } = await supabase
        .from("league_members" as never)
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active");
      if (memErr) {
        if (!cancelled) { setError(memErr.message); setLoading(false); }
        return;
      }
      const memList = (memberships ?? []) as unknown as LeagueMember[];
      if (memList.length === 0) {
        if (!cancelled) { setRows([]); setLoading(false); }
        return;
      }

      // 2. Fetch the parent leagues. RLS drops admin_only rows for us.
      const leagueIds = Array.from(new Set(memList.map((m) => m.league_id)));
      const { data: leagues } = await supabase
        .from("leagues" as never)
        .select("*")
        .in("id", leagueIds);
      const leagueList = (leagues ?? []) as unknown as League[];
      const leagueMap = new Map(leagueList.map((l) => [l.id, l]));

      // 3. Seasons + divisions the memberships point to (both optional).
      const seasonIds = memList.map((m) => m.season_id).filter(Boolean) as string[];
      const divisionIds = memList.map((m) => m.division_id).filter(Boolean) as string[];
      const [{ data: seasons }, { data: divisions }] = await Promise.all([
        seasonIds.length
          ? supabase.from("league_seasons" as never).select("*").in("id", seasonIds)
          : Promise.resolve({ data: [] as unknown as LeagueSeason[] }),
        divisionIds.length
          ? supabase.from("league_divisions" as never).select("*").in("id", divisionIds)
          : Promise.resolve({ data: [] as unknown as LeagueDivision[] }),
      ]);
      const seasonMap = new Map(((seasons ?? []) as unknown as LeagueSeason[]).map((s) => [s.id, s]));
      const divisionMap = new Map(((divisions ?? []) as unknown as LeagueDivision[]).map((d) => [d.id, d]));

      // 4. Join and drop any membership whose parent league was filtered
      //    out by RLS (admin_only) — surface only leagues the player can
      //    actually visit.
      const joined: MyLeagueRow[] = memList
        .map((m) => {
          const league = leagueMap.get(m.league_id);
          if (!league) return null;
          return {
            league,
            membership: m,
            season: m.season_id ? seasonMap.get(m.season_id) ?? null : null,
            division: m.division_id ? divisionMap.get(m.division_id) ?? null : null,
          } satisfies MyLeagueRow;
        })
        .filter((r): r is MyLeagueRow => r !== null);

      if (!cancelled) {
        setRows(joined);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { rows, loading, error };
}
