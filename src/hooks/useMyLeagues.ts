import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthState } from "@/hooks/useAuthState";
import { selectLeagueSeason } from '@/lib/leagues/operations';
import { leagueErrorMessage, leagueRows, leagueRowsByIds } from '@/lib/leagues/data';
import type {
  League, LeagueMember, LeagueSeason, LeagueSubstitute,
} from "@/lib/leagues/types";

export interface MyLeagueRow {
  league: League;
  membership: LeagueMember;
  season: LeagueSeason | null;
  isSubstitute?: boolean;
}

/**
 * Row shape returned by the get_my_leagues_with_context RPC. Snake_case
 * columns unqualified so the JOIN order in the SQL maps cleanly. All
 * season/division fields are nullable — the RPC uses LEFT JOINs.
 */
interface RpcRow {
  membership_id: string;
  membership_league_id: string;
  membership_season_id: string | null;
  membership_user_id: string;
  membership_role: LeagueMember["role"];
  membership_status: LeagueMember["status"];
  membership_joined_at: string;
  membership_created_at: string;
  membership_updated_at: string;

  league_id: string;
  league_name: string;
  league_description: string | null;
  league_location: string | null;
  league_community_id: string | null;
  league_created_by: string;
  league_status: League["status"];
  league_visibility: League["visibility"];
  league_league_type: League["league_type"];
  league_rating_eligible: boolean;
  league_guests_allowed: boolean;
  league_skill_min: number | null;
  league_skill_max: number | null;
  // invite_code intentionally NOT read on the player side — the RPC
  // no longer returns it.
  league_created_at: string;
  league_updated_at: string;

  season_id: string | null;
  season_league_id: string | null;
  season_name: string | null;
  season_start_date: string | null;
  season_end_date: string | null;
  season_registration_deadline: string | null;
  season_status: LeagueSeason["status"] | null;
  season_created_at: string | null;
  season_updated_at: string | null;
}

function mapRow(r: RpcRow): MyLeagueRow {
  return {
    membership: {
      id: r.membership_id,
      league_id: r.membership_league_id,
      season_id: r.membership_season_id,
      user_id: r.membership_user_id,
      role: r.membership_role,
      status: r.membership_status,
      joined_at: r.membership_joined_at,
      created_at: r.membership_created_at,
      updated_at: r.membership_updated_at,
    },
    league: {
      id: r.league_id,
      name: r.league_name,
      description: r.league_description,
      location: r.league_location,
      community_id: r.league_community_id,
      created_by: r.league_created_by,
      status: r.league_status,
      visibility: r.league_visibility,
      league_type: r.league_league_type,
      rating_eligible: r.league_rating_eligible,
      guests_allowed: r.league_guests_allowed,
      skill_min: r.league_skill_min,
      skill_max: r.league_skill_max,
      // invite_code is admin-owned metadata — not returned by the RPC
      // for player callers. Set to null to preserve the League shape.
      invite_code: null,
      created_at: r.league_created_at,
      updated_at: r.league_updated_at,
    },
    season: r.season_id ? {
      id: r.season_id,
      league_id: r.season_league_id!,
      name: r.season_name!,
      start_date: r.season_start_date,
      end_date: r.season_end_date,
      registration_deadline: r.season_registration_deadline,
      status: r.season_status!,
      created_at: r.season_created_at!,
      updated_at: r.season_updated_at!,
    } : null,
  };
}

/**
 * Reads the current player's active league memberships.
 *
 * Backed by a single SECURITY DEFINER RPC that server-side joins
 * memberships → leagues → seasons → divisions. Replaces the previous
 * three-round-trip implementation (members → leagues IN → seasons +
 * divisions parallel) — matters on Dashboard load for anyone in
 * multiple leagues.
 *
 * Server-side visibility rules (admin_only leagues drop out) are
 * enforced inside the RPC, matching client-side RLS.
 */
export function useMyLeagues() {
  const { user } = useAuthState();
  const query = useQuery({
    queryKey: ["my-leagues", user?.id],
    enabled: Boolean(user),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: 'always',
    queryFn: async (): Promise<MyLeagueRow[]> => {
      if (!user) return [];

      // Membership context and owner-only fallback are independent once the
      // shared auth provider supplies the user id. Run them together and let
      // React Query dedupe the dashboard wrapper/card consumers.
      const [membershipResult, ownedResult, subs] = await Promise.all([
        supabase.rpc("get_my_leagues_with_context" as never),
        supabase
          .from("leagues" as never)
          .select("*")
          .eq("created_by", user.id),
        leagueRows<LeagueSubstitute>('league_substitutes', { user_id: user.id, status: 'active' }),
      ]);

      if (membershipResult.error) throw membershipResult.error;
      const list = ((membershipResult.data ?? []) as unknown as RpcRow[]).map(mapRow);

      if (ownedResult.error) throw ownedResult.error;
      const [subLeagues, subSeasons] = await Promise.all([
        leagueRowsByIds<League>('leagues', subs.map(s => s.league_id)),
        leagueRowsByIds<LeagueSeason>('league_seasons', subs.map(s => s.season_id)),
      ]);
      for (const sub of subs) {
        const league = subLeagues.find(l => l.id === sub.league_id);
        if (!league || list.some(r => r.league.id === league.id && r.season?.id === sub.season_id)) continue;
        list.push({ league, season: subSeasons.find(s => s.id === sub.season_id) ?? null, isSubstitute: true,
          membership: { ...sub, id: `sub:${sub.id}`, role: 'player', status: 'active', joined_at: sub.created_at },
        });
      }

      const owned = (ownedResult.data ?? []) as unknown as League[];
      const have = new Set(list.map((row) => row.league.id));
      const synthetic: MyLeagueRow[] = owned
        .filter((league) => !have.has(league.id))
        .map((league) => ({
          league,
          membership: {
            id: `owner:${league.id}`,
            league_id: league.id,
            season_id: null,
            user_id: user.id,
            role: "manager",
            status: "active",
            joined_at: league.created_at,
            created_at: league.created_at,
            updated_at: league.updated_at,
          },
          season: null,
        }));

      const byLeague = new Map<string, MyLeagueRow[]>();
      for (const row of [...list, ...synthetic]) byLeague.set(row.league.id, [...(byLeague.get(row.league.id) ?? []), row]);
      const unique = [...byLeague.values()].map(group => {
        const season = selectLeagueSeason(group.map(row => row.season).filter((s): s is LeagueSeason => !!s));
        const chosen = group.find(row => row.season?.id === season?.id) ?? group[0];
        const manager = group.some(row => row.membership.role === 'manager') || chosen.league.created_by === user.id;
        return manager ? { ...chosen, membership: { ...chosen.membership, role: 'manager' as const } } : chosen;
      });
      return unique.sort((a, b) =>
        a.league.name.localeCompare(b.league.name),
      );
    },
  });

  const rows = query.data ?? [];
  const loading = Boolean(user) && query.isPending;
  const error = query.error ? leagueErrorMessage(query.error) : null;

  // Archived leagues are tucked away: `rows` (what every surface renders
  // by default) holds only live leagues, while `archivedRows` is opt-in
  // for the collapsed "Archived" section on the leagues hub.
  const activeRows = rows.filter((r) => r.league.status !== "archived");
  const archivedRows = rows.filter((r) => r.league.status === "archived");

  return { rows: activeRows, archivedRows, allRows: rows, loading, error };
}

