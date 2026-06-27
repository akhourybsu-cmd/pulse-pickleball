// Shared helper for resolving the display name of a single seat in a
// round_robin_schedule row. Handles both registered players and guests.
//
// A "seat" is one of the four playing slots in a match: a1, a2, b1, b2.
// Each seat has TWO mutually-exclusive id columns:
//   - <seat>_player_id  → references profiles_public(id)
//   - <seat>_guest_id   → references guest_players(id)
//
// When the schedule row is fetched with the standard join we use across the
// app, profile rows arrive as `a1_profile`, `a2_profile`, … and guest rows as
// `a1_guest`, `a2_guest`, … This helper centralizes the lookup so that no
// caller has to remember which columns to check or which fallback wins.

export type Seat = "a1" | "a2" | "b1" | "b2";

interface ProfileLike {
  display_name?: string | null;
  full_name?: string | null;
}

interface GuestLike {
  display_name?: string | null;
}

export interface SeatBearingMatch {
  a1_player_id?: string | null;
  a2_player_id?: string | null;
  b1_player_id?: string | null;
  b2_player_id?: string | null;
  a1_guest_id?: string | null;
  a2_guest_id?: string | null;
  b1_guest_id?: string | null;
  b2_guest_id?: string | null;
  a1_profile?: ProfileLike | null;
  a2_profile?: ProfileLike | null;
  b1_profile?: ProfileLike | null;
  b2_profile?: ProfileLike | null;
  a1_guest?: GuestLike | null;
  a2_guest?: GuestLike | null;
  b1_guest?: GuestLike | null;
  b2_guest?: GuestLike | null;
}

/** Name for a single seat, or "—" / fallback if the seat is empty. */
export function getSeatName(
  match: SeatBearingMatch | null | undefined,
  seat: Seat,
  options?: {
    /** Pluck names from this fallback name map (keyed by player or guest id). */
    nameMap?: Map<string, string>;
    /** Returned when no name can be resolved. Defaults to "—". */
    empty?: string;
  },
): string {
  const empty = options?.empty ?? "—";
  if (!match) return empty;

  const profile = match[`${seat}_profile` as const] as ProfileLike | null | undefined;
  const guest = match[`${seat}_guest` as const] as GuestLike | null | undefined;
  const playerId = match[`${seat}_player_id` as const] as string | null | undefined;
  const guestId = match[`${seat}_guest_id` as const] as string | null | undefined;

  if (profile?.display_name) return profile.display_name;
  if (profile?.full_name) return profile.full_name;
  if (guest?.display_name) return `${guest.display_name} (Guest)`;

  if (playerId && options?.nameMap?.has(playerId)) return options.nameMap.get(playerId)!;
  if (guestId && options?.nameMap?.has(guestId)) return `${options.nameMap.get(guestId)!} (Guest)`;

  if (!playerId && !guestId) return empty;
  return "Unknown Player";
}
