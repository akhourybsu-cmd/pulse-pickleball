import { supabase } from "@/integrations/supabase/client";

/**
 * Thin client wrapper around the log_league_action RPC. Silent-fails so
 * a bad audit write never blocks the real mutation — but we do console
 * it for diagnostics.
 */
export async function logLeagueAction(params: {
  leagueId: string | null;
  seasonId?: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  oldValue?: unknown;
  newValue?: unknown;
}): Promise<void> {
  const { error } = await supabase.rpc("log_league_action" as never, {
    p_league_id: params.leagueId,
    p_season_id: params.seasonId ?? null,
    p_action: params.action,
    p_entity_type: params.entityType,
    p_entity_id: params.entityId,
    p_old_value: (params.oldValue as never) ?? null,
    p_new_value: (params.newValue as never) ?? null,
  } as never);
  if (error) {
    console.error("[leagues] audit log failed", error);
  }
}
