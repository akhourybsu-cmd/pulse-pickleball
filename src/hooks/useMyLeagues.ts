import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type {
  League, LeagueMember, LeagueSeason,
} from "@/lib/leagues/types";

export interface MyLeagueRow {
  league: League;
  membership: LeagueMember;
  season: LeagueSeason | null;
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

      // Also surface leagues the caller OWNS but has no membership row
      // for. The RPC only returns active memberships, so a freshly
      // created league (owner not yet enrolled) or an admin_only league
      // would otherwise vanish from "My Leagues" — reading as "it didn't
      // persist." RLS lets an owner select their own league regardless,
      // so we merge those in with a synthetic manager membership. This
      // keeps the portal correct even before the auto-enroll migration
      // is deployed; once it is, the dedupe below prevents doubles.
      const { data: { user } } = await supabase.auth.getUser();
      let merged = list;
      if (user) {
        const { data: ownedRaw } = await supabase
          .from("leagues" as never)
          .select("*")
          .eq("created_by", user.id);
        const owned = (ownedRaw ?? []) as unknown as League[];
        const have = new Set(list.map((r) => r.league.id));
        const synthetic: MyLeagueRow[] = owned
          .filter((l) => !have.has(l.id))
          .map((l) => ({
            league: l,
            membership: {
              id: `owner:${l.id}`,
              league_id: l.id,
              season_id: null,
              user_id: user.id,
              role: "manager",
              status: "active",
              joined_at: l.created_at,
              created_at: l.created_at,
              updated_at: l.updated_at,
            },
            season: null,
          }));
        merged = [...list, ...synthetic].sort((a, b) =>
          a.league.name.localeCompare(b.league.name),
        );
      }

      if (!cancelled) {
        setRows(merged);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { rows, loading, error };
}
