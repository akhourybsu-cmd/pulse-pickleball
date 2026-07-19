import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type {
  League, LeagueMember, LeagueSeason, LeagueDivision, LeagueTeam,
  LeagueTeamMember, LeagueMatch,
} from "@/lib/leagues/types";

interface ProfileLite {
  id: string;
  display_name: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
}

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
  /** Set of team IDs the player is on. */
  myTeamIds: Set<string>;
  /** Every active teammate across every team the player is on. */
  teammates: Teammate[];
  /** All league_matches involving the player (via team or direct slot). */
  matches: LeagueMatch[];
  /** All matches the player can view in this league — used for standings. */
  allMatches: LeagueMatch[];
  /** All teams in the league — used for standings + opponent names. */
  allTeams: LeagueTeam[];
  /** Team-id → team row lookup, for match card rendering. */
  teamsById: Record<string, LeagueTeam>;
  /** Player-id → public profile, so match sides render as names. */
  playersById: Record<string, ProfileLite>;
  /** Current user's auth id — surfaced so match action components don't re-query. */
  currentUserId: string | null;
  loading: boolean;
  /** Bump to force a full re-fetch. */
  refresh: () => void;
}

/**
 * Player-scoped fetch for the league detail page. Trusts RLS to hide
 * anything the player shouldn't see; does the client-side filtering
 * for "matches involving me".
 */
export function useLeagueDetailForPlayer(leagueId: string | undefined): PlayerLeagueDetailData {
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);
  const [data, setData] = useState<PlayerLeagueDetailData>({
    league: null, membership: null, season: null, division: null,
    myTeams: [], myTeamIds: new Set<string>(),
    teammates: [], matches: [], allMatches: [], allTeams: [],
    teamsById: {},
    playersById: {},
    currentUserId: null,
    loading: true,
    refresh,
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
            myTeams: [], myTeamIds: new Set<string>(),
            teammates: [], matches: [], allMatches: [], allTeams: [],
            teamsById: {},
            playersById: {},
            currentUserId: user.id,
            loading: false,
            refresh,
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

      // 3. All teams in the league. Phase 4 broadened league_teams RLS
      //    so any active member can see every team in a league they can
      //    view — required for standings + opponent name lookup.
      const { data: teamsRaw } = await supabase
        .from("league_teams" as never).select("*").eq("league_id", leagueId);
      const allTeams = (teamsRaw ?? []) as unknown as LeagueTeam[];

      // Which of those am I actually on? Query league_team_members
      // scoped to the current user + the league's teams. RLS returns
      // only rows where user_id = auth.uid() OR I'm on the team, so
      // filtering by user_id here is defensive + explicit.
      const teamIdsInLeague = allTeams.map((t) => t.id);
      let myTeamIds = new Set<string>();
      if (teamIdsInLeague.length > 0) {
        const { data: myMemRows } = await supabase
          .from("league_team_members" as never)
          .select("team_id")
          .eq("user_id", user.id)
          .eq("status", "active")
          .in("team_id", teamIdsInLeague);
        myTeamIds = new Set(
          ((myMemRows ?? []) as { team_id: string }[]).map((r) => r.team_id),
        );
      }
      // Captains also count as "on the team" even without a member row.
      allTeams.forEach((t) => {
        if (t.captain_user_id === user.id) myTeamIds.add(t.id);
      });
      const myTeams = allTeams.filter((t) => myTeamIds.has(t.id));

      // 4. Team members for those teams — Phase 3 RLS returns everyone
      //    active on teams I'm on (not just me).
      let teammates: Teammate[] = [];
      const myTeamIdArray = Array.from(myTeamIds);
      if (myTeamIdArray.length > 0) {
        const { data: tmRows } = await supabase
          .from("league_team_members" as never).select("*")
          .in("team_id", myTeamIdArray).eq("status", "active");
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
      const mine = matchList.filter((m) => {
        const inTeam =
          (m.team_a_id && myTeamIds.has(m.team_a_id)) ||
          (m.team_b_id && myTeamIds.has(m.team_b_id));
        const inSlot =
          m.player_a_id === user.id ||
          m.player_b_id === user.id ||
          m.player_c_id === user.id ||
          m.player_d_id === user.id;
        return inTeam || inSlot;
      });

      // 6. Team lookup for match rendering. Now that RLS returns every
      //    team in the league, we can resolve opposing team names too.
      const teamsById: Record<string, LeagueTeam> = {};
      allTeams.forEach((t) => { teamsById[t.id] = t; });

      // 7. Names for every player slotted into a match, so sides render
      //    as people (mine + opponents) instead of "TBD"/"Opponent".
      const slotIds = Array.from(new Set(
        matchList
          .flatMap((m) => [m.player_a_id, m.player_b_id, m.player_c_id, m.player_d_id])
          .filter(Boolean) as string[],
      ));
      const playersById: Record<string, ProfileLite> = {};
      if (slotIds.length) {
        const { data: slotProfs } = await supabase
          .from("profiles_public" as never)
          .select("id, display_name, full_name, first_name, last_name, avatar_url")
          .in("id", slotIds);
        (slotProfs ?? []).forEach((p) => {
          const r = p as ProfileLite;
          playersById[r.id] = r;
        });
      }

      if (!cancelled) {
        setData({
          league, membership, season, division,
          myTeams, teammates, matches: mine, teamsById, playersById,
          // Full league dataset — needed for the standings section.
          allTeams, allMatches: matchList, myTeamIds,
          currentUserId: user.id,
          loading: false,
          refresh,
        });
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueId, tick]);

  return data;
}
