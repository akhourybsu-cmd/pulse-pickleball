import { supabase } from "@/integrations/supabase/client";
export interface ProgramWindow {
  start: Date;
  end: Date;
}
interface CourtOccupancy {
  venue_court_id: string | null;
  start_time: string;
  end_time: string | null;
  parent_event_id?: string | null;
  id?: string;
}
/** Read every occupied court, including private rentals and checkout holds. */
export async function fetchProgramAvailability(
  venueId: string,
  windows: ProgramWindow[],
  excludeEventId?: string,
): Promise<CourtOccupancy[]> {
  const results = await Promise.all(
    windows.flatMap(({ start, end }) =>
      ["venue_calendar_sessions", "venue_checkout_holds"].map((name) =>
        (supabase as any).rpc(name, {
          p_venue: venueId,
          p_from: start.toISOString(),
          p_to: end.toISOString(),
        }),
      ),
    ),
  );
  for (const result of results) {
    if (result.error) throw result.error;
    if (!Array.isArray(result.data))
      throw new Error(
        "Court availability could not be confirmed. Please retry.",
      );
  }
  return (results.flatMap((result) => result.data) as CourtOccupancy[]).filter(
    (s) =>
      !!s.venue_court_id &&
      (!excludeEventId ||
        (s.id !== excludeEventId && s.parent_event_id !== excludeEventId)),
  );
}
