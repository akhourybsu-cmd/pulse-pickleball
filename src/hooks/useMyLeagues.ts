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
 * Row shape returned by the get_my_leagues_with_context RPC. Snake_case
 * columns unqualified so the JOIN order in the SQL maps cleanly. All
 * season/division fields are nullable — the RPC uses LEFT JOINs.
 */
interface RpcRow {
  membership_id: string;
  membership_league_id: string;
  membership_season_id: string | null;
  membership_division_id: string | null;
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
  league_invite_code: string | null;
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

  division_id: string | null;
  division_league_id: string | null;
  division_season_id: string | null;
  division_name: string | null;
  division_skill_min: number | null;
  division_skill_max: number | null;
  division_description: string | null;
  division_status: LeagueDivision["status"] | null;
  division_created_at: string | null;
  division_updated_at: string | null;
}

function mapRow(r: RpcRow): MyLeagueRow {
  return {
    membership: {
      id: r.membership_id,
      league_id: r.membership_league_id,
      season_id: r.membership_season_id,
      division_id: r.membership_division_id,
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
      invite_code: r.league_invite_code,
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
    division: r.division_id ? {
      id: r.division_id,
      league_id: r.division_league_id!,
      season_id: r.division_season_id!,
      name: r.division_name!,
      skill_min: r.division_skill_min,
      skill_max: r.division_skill_max,
      description: r.division_description,
      status: r.division_status!,
      created_at: r.division_created_at!,
      updated_at: r.division_updated_at!,
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
  const [rows, setRows] = useState<MyLeagueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const { data, error: rpcErr } = await supabase
        .rpc("get_my_leagues_with_context" as never);
      if (rpcErr) {
        if (!cancelled) { setError(rpcErr.message); setLoading(false); }
        return;
      }
      const list = ((data ?? []) as unknown as RpcRow[]).map(mapRow);
      if (!cancelled) {
        setRows(list);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { rows, loading, error };
}
