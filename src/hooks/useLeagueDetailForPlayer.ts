import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type {
  League, LeagueMember, LeagueSeason, LeagueDivision, LeagueTeam,
  LeagueTeamMember, LeagueMatch,
} from "@/lib/leagues/types";

interface Teammate {
  team_member_id: string;
  team_id: string;
  team_name: string;
  user_id: string;
  is_me: boolean;
  is_captain: boolean;
  role: LeagueTeamMember["role"];
  display_name: string;
  avatar_url: string | null;
}

export interface PlayerLeagueDetailData {
  league: League | null;
  membership: LeagueMember | null;
  season: LeagueSeason | null;
  division: LeagueDivision | null;
  /** Teams the player is on (usually 0 or 1 per season). */
  myTeams: LeagueTeam[];
  /** Every active teammate across every team the player is on. */
  teammates: Teammate[];
  /** All league_matches involving the player (via team or direct slot). */
  matches: LeagueMatch[];
  /** Team-id → team row lookup, for match card rendering. */
  teamsById: Record<string, LeagueTeam>;
  loading: boolean;
}

/**
 * Player-scoped fetch for the league detail page. Trusts RLS to hide
 * anything the player shouldn't see; does the client-side filtering
 * for "matches involving me".
 */
export function useLeagueDetailForPlayer(leagueId: string | undefined): PlayerLeagueDetailData {
  const [data, setData] = useState<PlayerLeagueDetailData>({
    league: null, membership: null, season: null, division: null,
    myTeams: [], teammates: [], matches: [], teamsById: {},
    loading: true,
  });

  useEffect(() => {
    if (!leagueId) return;
    let cancelled = false;

    (async () => {
      setData((d) => ({ ...d, loading: true }));

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. League + membership. RLS drops anything invisible.
      const [{ data: leagueRow }, { data: memRow }] = await Promise.all([
        supabase.from("leagues" as never).select("*").eq("id", leagueId).maybeSingle(),
        supabase.from("league_members" as never).select("*")
          .eq("league_id", leagueId).eq("user_id", user.id).eq("status", "active")
          .maybeSingle(),
      ]);
      const league = (leagueRow ?? null) as unknown as League | null;
      const membership = (memRow ?? null) as unknown as LeagueMember | null;

      if (!league) {
        if (!cancelled) {
          setData({
            league: null, membership: null, season: null, division: null,
            myTeams: [], teammates: [], matches: [], teamsById: {},
            loading: false,
          });
        }
        return;
      }

      // 2. Season + division (both nullable).
      const [seasonR, divisionR] = await Promise.all([
        membership?.season_id
          ? supabase.from("league_seasons" as never).select("*").eq("id", membership.season_id).maybeSingle()
          : Promise.resolve({ data: null }),
        membership?.division_id
          ? supabase.from("league_divisions" as never).select("*").eq("id", membership.division_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      const season = (seasonR.data ?? null) as unknown as LeagueSeason | null;
      const division = (divisionR.data ?? null) as unknown as LeagueDivision | null;

      // 3. My teams — RLS narrows to only teams I'm on / captain.
      const { data: teamsRaw } = await supabase
        .from("league_teams" as never).select("*").eq("league_id", leagueId);
      const myTeams = (teamsRaw ?? []) as unknown as LeagueTeam[];
      const myTeamIds = myTeams.map((t) => t.id);

      // 4. Team members for those teams — after this migration, RLS
      //    returns everyone active on my teams (not just me).
      let teammates: Teammate[] = [];
      if (myTeamIds.length > 0) {
        const { data: tmRows } = await supabase
          .from("league_team_members" as never).select("*")
          .in("team_id", myTeamIds).eq("status", "active");
        const tmList = (tmRows ?? []) as unknown as LeagueTeamMember[];

        const userIds = Array.from(new Set(tmList.map((t) => t.user_id)));
        const { data: profRows } = userIds.length
          ? await supabase.from("profiles_public" as never)
              .select("id, display_name, full_name, first_name, last_name, avatar_url")
              .in("id", userIds)
          : { data: [] };
        const profMap = new Map(
          ((profRows ?? []) as { id: string; display_name: string | null; full_name: string | null; first_name: string | null; last_name: string | null; avatar_url: string | null }[])
            .map((p) => [p.id, p]),
        );
        const teamMap = new Map(myTeams.map((t) => [t.id, t]));

        teammates = tmList.map((tm) => {
          const team = teamMap.get(tm.team_id);
          const p = profMap.get(tm.user_id);
          const name =
            p?.display_name?.trim() ||
            p?.full_name?.trim() ||
            [p?.first_name, p?.last_name].filter(Boolean).join(" ").trim() ||
            "Player";
          return {
            team_member_id: tm.id,
            team_id: tm.team_id,
            team_name: team?.name ?? "Team",
            user_id: tm.user_id,
            is_me: tm.user_id === user.id,
            is_captain: team?.captain_user_id === tm.user_id,
            role: tm.role,
            display_name: name,
            avatar_url: p?.avatar_url ?? null,
          };
        });
      }

      // 5. All league_matches I have access to. RLS returned matches
      //    for leagues I can view; filter client-side to matches I'm
      //    actually IN.
      const { data: allMatches } = await supabase
        .from("league_matches" as never).select("*")
        .eq("league_id", leagueId).order("scheduled_time", { ascending: true, nullsFirst: false });
      const matchList = (allMatches ?? []) as unknown as LeagueMatch[];
      const teamIdSet = new Set(myTeamIds);
      const mine = matchList.filter((m) => {
        const inTeam =
          (m.team_a_id && teamIdSet.has(m.team_a_id)) ||
          (m.team_b_id && teamIdSet.has(m.team_b_id));
        const inSlot =
          m.player_a_id === user.id ||
          m.player_b_id === user.id ||
          m.player_c_id === user.id ||
          m.player_d_id === user.id;
        return inTeam || inSlot;
      });

      // 6. Team lookup for match rendering — include teams referenced
      //    by any of my matches, even if I'm not on the opposing team.
      //    Opposing teams show as "Team A", "Team B" via a separate
      //    fetch. Skip on this pass — the admin_only-adjacent teams
      //    aren't visible under player RLS anyway. The card will show
      //    "Opponent" when we can't resolve the name.
      const teamsById: Record<string, LeagueTeam> = {};
      myTeams.forEach((t) => { teamsById[t.id] = t; });

      if (!cancelled) {
        setData({
          league, membership, season, division,
          myTeams, teammates, matches: mine, teamsById,
          loading: false,
        });
      }
    })();

    return () => { cancelled = true; };
  }, [leagueId]);

  return data;
}
