import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type RoundRobinScheduleRow =
  Database["public"]["Tables"]["round_robin_schedule"]["Row"];

export const ROUND_ROBIN_SCHEDULE_PAGE_SIZE = 1_000;

/**
 * Load the complete canonical schedule in stable round/court/id order.
 *
 * Supabase projects commonly cap one PostgREST response at 1,000 rows. A
 * legal long rotation can exceed that once explicit bye rows are included, so
 * every app surface must page rather than treating the first response as the
 * whole event.
 */
export async function fetchCanonicalRoundRobinSchedule(
  client: SupabaseClient<Database>,
  eventId: string,
  signal?: AbortSignal,
): Promise<RoundRobinScheduleRow[]> {
  const schedule: RoundRobinScheduleRow[] = [];

  for (
    let offset = 0;
    ;
    offset += ROUND_ROBIN_SCHEDULE_PAGE_SIZE
  ) {
    const query = client
      .from("round_robin_schedule")
      .select("*")
      .eq("event_id", eventId)
      .is("voided_at", null)
      .is("superseded_by_schedule_id", null)
      .order("round_no", { ascending: true })
      .order("court_no", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + ROUND_ROBIN_SCHEDULE_PAGE_SIZE - 1);
    const { data, error } = await (signal ? query.abortSignal(signal) : query);

    if (error) throw error;

    const page = data ?? [];
    schedule.push(...page);
    if (page.length < ROUND_ROBIN_SCHEDULE_PAGE_SIZE) break;
  }

  return schedule;
}
