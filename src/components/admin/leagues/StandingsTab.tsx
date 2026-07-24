import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trophy } from "lucide-react";
import type {
  LeagueSeason, LeagueMatch, LeagueTeam,
} from "@/lib/leagues/types";
import {
  computePlayerStandings, computeTeamStandings,
} from "@/lib/leagues/standings";
import { resolvePlayerName } from "@/lib/matchDisplay";
import { StandingsTable } from "@/components/leagues/StandingsTable";
import { EmptyState, TabSkeleton, LeagueTabProps, SeasonSelect } from "./_shared";

interface ProfileRow {
  id: string;
  display_name: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
}

export function StandingsTab({ league, dataVersion }: LeagueTabProps) {
  const isTeamMode =
    league.league_type === "doubles" || league.league_type === "team";
  const [seasons, setSeasons] = useState<LeagueSeason[]>([]);
  const [seasonId, setSeasonId] = useState<string | "">("");
  const [matches, setMatches] = useState<LeagueMatch[]>([]);
  const [teams, setTeams] = useState<LeagueTeam[]>([]);
  const [namesById, setNamesById] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  // Season list — subscribes to dataVersion so new seasons appear.
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("league_seasons" as never).select("*")
        .eq("league_id", league.id).order("created_at", { ascending: false });
      const list = (data ?? []) as unknown as LeagueSeason[];
      setSeasons(list);
      if (list.length && !seasonId) setSeasonId(list[0].id);
      setLoading(false);
    })();
    // eslint-disable-next-line
  }, [league.id, dataVersion]);

  // Reload matches whenever season changes, then resolve the names of every
  // player who appears in a match slot.
  useEffect(() => {
    if (!seasonId) return;
    (async () => {
      const [{ data: m }, { data: t }] = await Promise.all([
        supabase.from("league_matches" as never).select("*")
          .eq("league_id", league.id).eq("season_id", seasonId),
        supabase.from("league_teams" as never).select("*").eq("season_id", seasonId),
      ]);
      const matchList = (m ?? []) as unknown as LeagueMatch[];
      setMatches(matchList);
      setTeams((t ?? []) as unknown as LeagueTeam[]);

      const ids = Array.from(new Set(
        matchList
          .flatMap((x) => [x.player_a_id, x.player_b_id, x.player_c_id, x.player_d_id])
          .filter(Boolean) as string[],
      ));
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles_public" as never)
          .select("id, display_name, full_name, first_name, last_name")
          .in("id", ids);
        const map: Record<string, string> = {};
        (profs ?? []).forEach((p) => {
          const r = p as ProfileRow;
          map[r.id] = resolvePlayerName(r);
        });
        setNamesById(map);
      } else {
        setNamesById({});
      }
    })().catch((e) => toast.error(e.message));
  }, [seasonId, dataVersion, league.id]);

  const rows = useMemo(() => {
    const opts = { seasonId: seasonId || undefined };
    if (isTeamMode) {
      return computeTeamStandings(matches, teams, opts);
    }
    return computePlayerStandings(matches, (id) => namesById[id] ?? "Player", opts);
  }, [matches, teams, namesById, seasonId, isTeamMode]);

  if (loading) return <TabSkeleton lines={4} />;

  if (seasons.length === 0) {
    return (
      <EmptyState
        icon={<Trophy className="w-5 h-5" />}
        title="Create a season first"
        desc="Standings are computed per season."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-center flex-wrap">
        <SeasonSelect seasons={seasons} value={seasonId} onChange={setSeasonId} className="flex-1 min-w-[140px]" />
      </div>

      <p className="text-xs text-muted-foreground">
        {isTeamMode
          ? "Team standings from verified & submitted scores. Sort: wins → head-to-head → point differential → win %."
          : "Individual standings from verified & submitted scores. Sort: wins → head-to-head (pairwise ties) → point differential → win %."}
      </p>

      <StandingsTable
        rows={rows}
        nameHeader={isTeamMode ? "Team" : "Player"}
        emptyMessage="No completed matches in this season yet."
      />
    </div>
  );
}
