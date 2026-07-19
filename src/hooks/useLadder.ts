import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { resolvePlayerName } from "@/lib/matchDisplay";

/**
 * Reads the ladder state for a season: settings, roster, the active
 * (unfinalized) batch with its court groups + games, the current ladder
 * order (latest snapshot), the movements from the last finalized batch,
 * and finalized-batch history.
 *
 * Ladder tables aren't in the generated types yet, so reads use `as never`
 * casts (same pattern as the rest of League Play).
 */

export interface LadderSettings {
  id: string;
  league_id: string;
  season_id: string;
  batches_per_week: number;
  court_count: number;
  total_weeks: number | null;
  movement_rule: string;
  scoring_format: string;
  initial_order_source: "manual" | "pulse_rating" | "random" | "prior_season";
  status: "setup" | "active" | "paused" | "complete";
}

export interface LadderBatch {
  id: string;
  week_number: number;
  batch_number: number;
  status: "generated" | "in_progress" | "complete" | "finalized" | "invalidated";
  start_snapshot_id: string;
  result_snapshot_id: string | null;
  session_id: string | null;
}

export interface LadderGroup {
  id: string;
  group_index: number;
  court_number: number | null;
  wave: number;
  player_ids: string[];
}

export interface LadderGame {
  id: string;
  ladder_batch_group_id: string;
  ladder_game_number: number;
  player_a_id: string | null;
  player_b_id: string | null;
  player_c_id: string | null;
  player_d_id: string | null;
  team_a_score: number | null;
  team_b_score: number | null;
  status: string;
}

export interface LadderMovementRow {
  player_id: string;
  group_id: string;
  start_position: number;
  finish_position: number;
  direction: "up" | "stay" | "down";
  capped: "top" | "bottom" | null;
  wins: number;
  losses: number;
  points_for: number;
  points_against: number;
}

export interface LadderData {
  loading: boolean;
  settings: LadderSettings | null;
  memberIds: string[];
  nameOf: (id: string) => string;
  started: boolean;
  activeBatch: LadderBatch | null;
  groups: LadderGroup[];
  games: LadderGame[];
  currentOrder: string[];
  lastMovements: LadderMovementRow[];
  history: LadderBatch[];
  refresh: () => void;
}

export function useLadder(
  leagueId: string,
  seasonId: string | "",
  dataVersion = 0,
): LadderData {
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);
  const [data, setData] = useState<LadderData>({
    loading: true, settings: null, memberIds: [], nameOf: (id) => id.slice(0, 8),
    started: false, activeBatch: null, groups: [], games: [],
    currentOrder: [], lastMovements: [], history: [], refresh,
  });

  useEffect(() => {
    if (!seasonId) { setData((d) => ({ ...d, loading: false })); return; }
    let cancelled = false;

    (async () => {
      setData((d) => ({ ...d, loading: true }));

      const [{ data: settingsRow }, { data: mems }, { data: batchRows }, { data: snapRows }] =
        await Promise.all([
          supabase.from("ladder_settings" as never).select("*").eq("season_id", seasonId).maybeSingle(),
          supabase.from("league_members" as never).select("user_id")
            .eq("season_id", seasonId).eq("status", "active"),
          supabase.from("ladder_batches" as never).select("*")
            .eq("season_id", seasonId)
            .order("week_number", { ascending: true })
            .order("batch_number", { ascending: true }),
          supabase.from("ladder_snapshots" as never).select("*")
            .eq("season_id", seasonId)
            .order("week_number", { ascending: false })
            .order("batch_number", { ascending: false }),
        ]);

      const settings = (settingsRow ?? null) as unknown as LadderSettings | null;
      const memberIds = ((mems ?? []) as Array<{ user_id: string }>).map((m) => m.user_id);
      const batches = (batchRows ?? []) as unknown as LadderBatch[];
      const snapshots = (snapRows ?? []) as unknown as Array<{ player_ids: string[] }>;

      // Names for members + everyone in the latest snapshot.
      const nameIds = new Set<string>(memberIds);
      snapshots[0]?.player_ids?.forEach((id) => nameIds.add(id));
      const namesById: Record<string, string> = {};
      if (nameIds.size) {
        const { data: profs } = await supabase
          .from("profiles_public" as never)
          .select("id, display_name, full_name, first_name, last_name")
          .in("id", Array.from(nameIds));
        (profs ?? []).forEach((p) => {
          const r = p as { id: string };
          namesById[r.id] = resolvePlayerName(p as never);
        });
      }
      const nameOf = (id: string) => namesById[id] ?? id.slice(0, 8);

      const currentOrder = snapshots[0]?.player_ids ?? [];
      const activeBatch =
        batches.find((b) => b.status !== "finalized" && b.status !== "invalidated") ?? null;
      const history = batches.filter((b) => b.status === "finalized");

      // Active batch's groups + games.
      let groups: LadderGroup[] = [];
      let games: LadderGame[] = [];
      if (activeBatch) {
        const { data: grpRows } = await supabase.from("ladder_batch_groups" as never)
          .select("*").eq("batch_id", activeBatch.id)
          .order("group_index", { ascending: true });
        groups = (grpRows ?? []) as unknown as LadderGroup[];
        if (groups.length) {
          const { data: gameRows } = await supabase.from("league_matches" as never)
            .select("*").in("ladder_batch_group_id", groups.map((g) => g.id));
          games = (gameRows ?? []) as unknown as LadderGame[];
        }
      }

      // Movements from the most recently finalized batch.
      let lastMovements: LadderMovementRow[] = [];
      const lastFinal = [...history].sort(
        (a, b) => b.week_number - a.week_number || b.batch_number - a.batch_number,
      )[0];
      if (lastFinal) {
        const { data: mv } = await supabase.from("ladder_movements" as never)
          .select("*").eq("batch_id", lastFinal.id);
        lastMovements = (mv ?? []) as unknown as LadderMovementRow[];
      }

      if (!cancelled) {
        setData({
          loading: false, settings, memberIds, nameOf,
          started: batches.length > 0, activeBatch, groups, games,
          currentOrder, lastMovements, history, refresh,
        });
      }
    })().catch(() => { if (!cancelled) setData((d) => ({ ...d, loading: false })); });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueId, seasonId, dataVersion, tick]);

  return data;
}
