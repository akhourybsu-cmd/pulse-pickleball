import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Trophy } from "lucide-react";
import type {
  LeagueSeason, LeagueDivision, LeagueTeam, LeagueMatch,
} from "@/lib/leagues/types";
import { computeTeamStandings } from "@/lib/leagues/standings";
import { StandingsTable } from "@/components/leagues/StandingsTable";
import { EmptyState, TabSkeleton, LeagueTabProps } from "./_shared";

export function StandingsTab({ league, dataVersion }: LeagueTabProps) {
  const [seasons, setSeasons] = useState<LeagueSeason[]>([]);
  const [seasonId, setSeasonId] = useState<string | "">("");
  const [divisions, setDivisions] = useState<LeagueDivision[]>([]);
  const [divisionId, setDivisionId] = useState<string | "all">("all");
  const [teams, setTeams] = useState<LeagueTeam[]>([]);
  const [matches, setMatches] = useState<LeagueMatch[]>([]);
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

  // Reload teams + divisions + matches whenever season changes.
  useEffect(() => {
    if (!seasonId) return;
    (async () => {
      const [{ data: divs }, { data: t }, { data: m }] = await Promise.all([
        supabase.from("league_divisions" as never).select("*").eq("season_id", seasonId),
        supabase.from("league_teams" as never).select("*").eq("season_id", seasonId),
        supabase.from("league_matches" as never).select("*")
          .eq("league_id", league.id).eq("season_id", seasonId),
      ]);
      if (divs) setDivisions(divs as unknown as LeagueDivision[]);
      if (t) setTeams(t as unknown as LeagueTeam[]);
      if (m) setMatches(m as unknown as LeagueMatch[]);
    })().catch((e) => toast.error(e.message));
  }, [seasonId, dataVersion, league.id]);

  const rows = useMemo(() => {
    const filteredTeams = divisionId === "all"
      ? teams
      : teams.filter((t) => t.division_id === divisionId);
    return computeTeamStandings(matches, filteredTeams, {
      seasonId: seasonId || undefined,
      // divisionId=null means "unassigned"; only pass explicit selections
      divisionId: divisionId === "all" ? undefined : divisionId,
    });
  }, [matches, teams, seasonId, divisionId]);

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
        <Select value={seasonId} onValueChange={setSeasonId}>
          <SelectTrigger className="flex-1 min-w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {seasons.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={divisionId} onValueChange={setDivisionId}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All divisions</SelectItem>
            {divisions.map((d) => (
              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <p className="text-xs text-muted-foreground">
        Wins from verified, score-submitted, and forfeit matches. Sort:
        wins → head-to-head (pairwise ties) → point differential → win %.
      </p>

      <StandingsTable
        rows={rows}
        emptyMessage="No completed matches in this season yet."
      />
    </div>
  );
}
