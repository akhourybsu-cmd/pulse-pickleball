import { supabase } from "@/integrations/supabase/client";

export type RoundRobinUserRole = "host" | "player";

export interface RoundRobinUserEvent {
  id: string;
  name: string;
  date: string;
  status: "draft" | "live" | "completed" | "voided";
  current_round: number | null;
  num_rounds: number;
  num_courts: number;
  organizer_id: string;
  voided: boolean | null;
  [key: string]: unknown;
}

export interface RoundRobinUserEventEntry {
  event: RoundRobinUserEvent;
  role: RoundRobinUserRole;
}

interface FetchUserRoundRobinEventsOptions {
  /** Include registrations that have been withdrawn or removed. */
  includeInactiveRegistrations?: boolean;
}

/**
 * Load every round robin a user hosts or participates in without relying on
 * PostgREST relationship embedding.
 *
 * The Lovable database exposed implicit `round_robin_players ->
 * round_robin_events` embeds that are not portable to every PostgREST schema
 * cache. After the Supabase cutover those embeds could fail the entire request,
 * making a user with real events look as though they had none. Explicit IDs +
 * a batched event read keep the contract stable across projects.
 */
export async function fetchUserRoundRobinEvents(
  userId: string,
  options: FetchUserRoundRobinEventsOptions = {},
): Promise<RoundRobinUserEventEntry[]> {
  let registrationQuery = supabase
    .from("round_robin_players")
    .select("event_id")
    .eq("player_id", userId);

  if (!options.includeInactiveRegistrations) {
    registrationQuery = registrationQuery.eq("active", true);
  }

  const [hostedResult, registrationResult] = await Promise.all([
    supabase
      .from("round_robin_events")
      .select("id, name, date, status, current_round, num_rounds, num_courts, organizer_id, voided")
      .eq("organizer_id", userId),
    registrationQuery,
  ]);

  if (hostedResult.error) throw hostedResult.error;
  if (registrationResult.error) throw registrationResult.error;

  const hosted = (hostedResult.data ?? []) as unknown as RoundRobinUserEvent[];
  const hostedIds = new Set(hosted.map((event) => event.id));
  const participatingIds = [
    ...new Set(
      (registrationResult.data ?? [])
        .map((registration) => registration.event_id)
        .filter((eventId) => !hostedIds.has(eventId)),
    ),
  ];

  let participating: RoundRobinUserEvent[] = [];
  if (participatingIds.length > 0) {
    const { data, error } = await supabase
      .from("round_robin_events")
      .select("id, name, date, status, current_round, num_rounds, num_courts, organizer_id, voided")
      .in("id", participatingIds);
    if (error) throw error;
    participating = (data ?? []) as unknown as RoundRobinUserEvent[];
  }

  return [
    ...hosted.map((event) => ({ event, role: "host" as const })),
    ...participating.map((event) => ({ event, role: "player" as const })),
  ];
}
