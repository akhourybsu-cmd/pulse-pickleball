/**
 * Shared resolver for a round_robin_players row.
 *
 * Round robin rosters can contain three flavours of "player":
 *   1. A real registered user (player_id → profiles)
 *   2. A reusable guest record (guest_player_id → guest_players)
 *   3. A legacy ad-hoc guest (guest_name only, no FK)
 *
 * Views that render rosters, standings, schedules, kiosk, and score entry should
 * funnel every row through `resolveRRParticipant` so the display logic stays in
 * one place and we never accidentally render "Unknown" for a guest.
 */

export interface RRParticipantInput {
  id?: string;
  player_id?: string | null;
  guest_player_id?: string | null;
  guest_name?: string | null;
  profiles?: {
    id?: string | null;
    display_name?: string | null;
    full_name?: string | null;
    avatar_url?: string | null;
  } | null;
  guest_players?: {
    id?: string | null;
    display_name?: string | null;
    linked_user_id?: string | null;
  } | null;
}

export interface ResolvedRRParticipant {
  /** round_robin_players.id (row id), if available */
  rowId: string | null;
  /** Stable identity used for grouping/standings (profile id, guest id, or row id) */
  identityId: string;
  name: string;
  avatarUrl: string | null;
  isGuest: boolean;
  isLinkedGuest: boolean;
  linkedUserId: string | null;
}

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

export function resolveRRParticipant(row: RRParticipantInput): ResolvedRRParticipant {
  const profile = row.profiles ?? null;
  const guest = row.guest_players ?? null;

  if (profile?.id) {
    const name = profile.display_name || profile.full_name || "Player";
    return {
      rowId: row.id ?? null,
      identityId: profile.id,
      name,
      avatarUrl: profile.avatar_url ?? null,
      isGuest: false,
      isLinkedGuest: false,
      linkedUserId: null,
    };
  }

  if (guest?.id) {
    const name = guest.display_name?.trim() || "Guest";
    return {
      rowId: row.id ?? null,
      identityId: guest.id,
      name,
      avatarUrl: null,
      isGuest: true,
      isLinkedGuest: !!guest.linked_user_id,
      linkedUserId: guest.linked_user_id ?? null,
    };
  }

  // Legacy ad-hoc guest: only a plain string is available.
  if (row.guest_name) {
    return {
      rowId: row.id ?? null,
      identityId: row.id ?? row.guest_name,
      name: row.guest_name,
      avatarUrl: null,
      isGuest: true,
      isLinkedGuest: false,
      linkedUserId: null,
    };
  }

  return {
    rowId: row.id ?? null,
    identityId: row.id ?? "unknown",
    name: "Open slot",
    avatarUrl: null,
    isGuest: true,
    isLinkedGuest: false,
    linkedUserId: null,
  };
}

export function rrParticipantInitials(p: ResolvedRRParticipant): string {
  return initialsOf(p.name) || "?";
}
