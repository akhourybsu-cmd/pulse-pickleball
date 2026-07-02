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

      const filtered = publicLeagues.filter((l) => !alreadyMember.has(l.id));

      if (!cancelled) {
        setLeagues(filtered);
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  return { leagues, loading, error };
}
