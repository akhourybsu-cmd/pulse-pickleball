import { useLeagueWorkspace } from '@/hooks/useLeagueWorkspace';
import { useLeagueSeasons } from '@/hooks/useLeagueSeasons';
import { leagueErrorMessage } from '@/lib/leagues/data';
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


export function StandingsTab({ league, dataVersion, onNavigate }: LeagueTabProps) {
  const isTeamMode =
    league.league_type === "doubles" || league.league_type === "team";
  const { seasons, seasonId, setSeasonId, loading: seasonsLoading, error: seasonsError, retry } = useLeagueSeasons(league.id, dataVersion);
  const { matches, teams, profilesById, loading: rowsLoading, error: rowsError, reload } = useLeagueWorkspace(league.id, seasonId, dataVersion, ['matches', 'teams']);
  const loading = seasonsLoading || rowsLoading;
  const error = seasonsError ?? rowsError;


  // Season list — subscribes to dataVersion so new seasons appear.


  // Reload matches whenever season changes, then resolve the names of every
  // player who appears in a match slot.
  const rows = useMemo(() => {
    if (isTeamMode) {
      return computeTeamStandings(matches, teams, { seasonId: seasonId || undefined });
    }
    return computePlayerStandings(matches, (id) => profilesById[id] ? resolvePlayerName(profilesById[id]) : "Player", {
      seasonId: seasonId || undefined,
    });
  }, [matches, teams, profilesById, seasonId, isTeamMode]);

  if (error) return <EmptyState title="Couldn't load this season" desc={leagueErrorMessage(error)} action={{ label: 'Try again', onClick: () => { void retry(); void reload(); } }} />;
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
      {onNavigate && league.league_type === "ladder" && (
        <button
          type="button"
          onClick={() => onNavigate("ladder")}
          className="-ml-1 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Back to ladder
        </button>
      )}
      <div className="flex gap-2 items-center flex-wrap">
        <SeasonSelect seasons={seasons} value={seasonId} onChange={setSeasonId} className="flex-1 min-w-[140px]" />
      </div>

      <p className="text-xs text-muted-foreground">
        {isTeamMode
          ? "Team standings from confirmed scores. Sort: wins → head-to-head → point differential → win %."
          : "Individual standings from confirmed scores. Sort: wins → head-to-head (pairwise ties) → point differential → win %."}
      </p>

      <StandingsTable
        rows={rows}
        nameHeader={isTeamMode ? "Team" : "Player"}
        emptyMessage="No completed matches in this season yet."
      />
    </div>
  );
}
