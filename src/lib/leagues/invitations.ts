import { supabase } from "@/integrations/supabase/client";
import { withAuthDeadline } from "@/lib/authDeadline";
import type { LeagueTeaser } from "./types";

export async function lookupLeagueInvitation(
  code: string
): Promise<LeagueTeaser> {
  const { data, error } = await withAuthDeadline((signal) =>
    supabase
      .rpc(
        "find_league_by_invite_code" as never,
        { p_code: code.trim() } as never
      )
      .abortSignal(signal)
  );
  if (error) throw error;
  const payload: unknown = data;
  const row = (
    Array.isArray(payload) ? payload[0] : payload
  ) as LeagueTeaser | null;
  if (!row?.id || !row.name)
    throw new Error(
      "No league matches this invitation. Ask the organizer for a current code."
    );
  return row;
}

export async function joinLeagueInvitation(
  code: string,
  expectedLeagueId: string
): Promise<string> {
  const { data, error } = await withAuthDeadline((signal) =>
    supabase
      .rpc("join_league_by_code" as never, { p_code: code.trim() } as never)
      .abortSignal(signal)
  );
  if (error) throw error;
  if (typeof data !== "string" || data !== expectedLeagueId) {
    throw new Error(
      "We could not confirm your membership. Check My leagues before trying again."
    );
  }
  return data;
}

export function leagueInvitationError(error: unknown): string {
  const info = error as { code?: string; message?: string; name?: string };
  if (info?.code === "02000")
    return "This invitation has changed. Ask the organizer for a current code.";
  if (info?.code === "22023")
    return "Registration is not open. Ask the organizer about joining the next season.";
  if (info?.name === "TimeoutError")
    return "The connection timed out. Please try again. If you were joining, check My leagues first.";
  if (error instanceof Error && !info.code && !(error instanceof TypeError))
    return error.message;
  return "We could not connect to the league. Check your connection and try again.";
}
