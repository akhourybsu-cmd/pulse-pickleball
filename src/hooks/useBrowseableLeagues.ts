import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { League } from "@/lib/leagues/types";

/**
 * Returns all `visibility = 'public_future'` leagues the current player
 * can browse but isn't already an active member of. Trusts the Phase 2
 * RLS policy ("Signed-in users can browse public leagues") to drop
 * anything they shouldn't see.
 *
 * We filter out leagues the player is already in — no point showing
 * "join this league" for one they're already in. That'd be confusing.
 */
export function useBrowseableLeagues() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) { setLeagues([]); setLoading(false); }
        return;
      }

      // Pull public_future leagues. Sort newest-first — recently
      // created leagues are usually what the player is looking for.
      const { data, error: fetchErr } = await supabase
        .from("leagues" as never)
        .select("*")
        .eq("visibility", "public_future")
        .eq("status", "active")
        .order("created_at", { ascending: false });
      if (fetchErr) {
        if (!cancelled) { setError(fetchErr.message); setLoading(false); }
        return;
      }
      const publicLeagues = (data ?? []) as unknown as League[];

      // Drop leagues the player is already actively in.
      const { data: memRows } = await supabase
        .from("league_members" as never)
        .select("league_id")
        .eq("user_id", user.id)
        .eq("status", "active");
      const alreadyMember = new Set(
        ((memRows ?? []) as { league_id: string }[]).map((r) => r.league_id),
      );

      // Also drop leagues whose active seasons have all closed
      // registration. Showing them in Discover would just lead to a
      // "Registration closed" dead-end in the Join dialog. The dialog
      // is still the source of truth — this is a UX pre-filter.
      const candidateIds = publicLeagues
        .filter((l) => !alreadyMember.has(l.id))
        .map((l) => l.id);
      let closedOnlyIds = new Set<string>();
      if (candidateIds.length > 0) {
        const today = new Date().toISOString().slice(0, 10);
        // Grab seasons for the candidate leagues; group locally so we
        // can spot leagues where every active season has a past
        // registration_deadline.
        const { data: seasonRows } = await supabase
          .from("league_seasons" as never)
          .select("league_id, status, registration_deadline")
          .in("league_id", candidateIds);
        const bucket = new Map<string, Array<{ status: string; deadline: string | null }>>();
        ((seasonRows ?? []) as { league_id: string; status: string; registration_deadline: string | null }[])
          .forEach((s) => {
            const list = bucket.get(s.league_id) ?? [];
            list.push({ status: s.status, deadline: s.registration_deadline });
            bucket.set(s.league_id, list);
          });
        bucket.forEach((seasons, leagueId) => {
          const actives = seasons.filter((s) => s.status === "active");
          // Only mark closed when the league has active seasons AND
          // every one is past its deadline. Leagues with no active
          // seasons yet stay browseable — the admin may still be
          // scaffolding.
          if (actives.length === 0) return;
          const allPast = actives.every(
            (s) => s.deadline !== null && s.deadline < today,
          );
          if (allPast) closedOnlyIds.add(leagueId);
        });
      }

      const filtered = publicLeagues.filter(
        (l) => !alreadyMember.has(l.id) && !closedOnlyIds.has(l.id),
      );

      if (!cancelled) {
        setLeagues(filtered);
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  return { leagues, loading, error };
}
