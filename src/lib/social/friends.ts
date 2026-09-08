import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export interface FriendProfile {
  id: string;
  display_name: string | null;
  full_name: string | null;
  avatar_url: string | null;
  current_rating: number | null;
  gender: string | null;
  handle?: string | null;
}

export interface Friendship {
  id: string;
  user_id: string;
  friend_id: string;
  status: "pending" | "accepted" | "blocked";
  created_at: string;
  accepted_at: string | null;
}

export interface FriendWithProfile extends Friendship {
  profile: FriendProfile;
}
export interface FriendRequest {
  id: string;
  user_id: string;
  created_at: string;
  profile: FriendProfile;
}
export interface FriendsSnapshot {
  relationships: FriendWithProfile[];
  blockedIds: string[];
}
export type FriendAction =
  | "send"
  | "accept"
  | "decline"
  | "cancel"
  | "remove"
  | "block";
export interface FriendChange {
  action: FriendAction;
  targetId: string;
  friendshipId?: string;
  profile?: FriendProfile;
}

export const friendsKey = (userId: string | null) =>
  ["friends", userId] as const;
export const friendActionKey = (userId: string | null) =>
  ["friend-action", userId] as const;
export const emptyFriends = (): FriendsSnapshot => ({
  relationships: [],
  blockedIds: [],
});
export const friendName = (
  profile: Pick<FriendProfile, "display_name" | "full_name">
) => profile.display_name?.trim() || profile.full_name?.trim() || "Player";

const searchable = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase();
export function matchesFriend(profile: FriendProfile, search: string) {
  const haystack = searchable(
    [profile.display_name, profile.full_name, profile.handle]
      .filter(Boolean)
      .join(" ")
  );
  return searchable(search)
    .trim()
    .split(/\s+/)
    .every((token) => haystack.includes(token.replace(/^@/, "")));
}

export function placeholderProfile(id: string): FriendProfile {
  return {
    id,
    display_name: null,
    full_name: null,
    avatar_url: null,
    current_rating: null,
    gender: null,
  };
}

export function normalizeRelationships(
  rows: FriendWithProfile[],
  blockedIds: string[]
) {
  const blocked = new Set(blockedIds);
  const byPerson = new Map<string, FriendWithProfile>();
  const priority = { blocked: 3, accepted: 2, pending: 1 };
  for (const row of rows) {
    if (blocked.has(row.profile.id)) continue;
    const previous = byPerson.get(row.profile.id);
    if (!previous || priority[row.status] > priority[previous.status])
      byPerson.set(row.profile.id, row);
  }
  return [...byPerson.values()];
}

export function optimisticFriendChange(
  state: FriendsSnapshot,
  change: FriendChange,
  userId: string,
  now: string
): FriendsSnapshot {
  const others = state.relationships.filter(
    (row) => row.profile.id !== change.targetId
  );
  const existing = state.relationships.find(
    (row) => row.profile.id === change.targetId
  );
  if (change.action === "block")
    return {
      relationships: others,
      blockedIds: [...new Set([...state.blockedIds, change.targetId])],
    };
  if (change.action === "send") {
    if (existing) return state;
    return {
      ...state,
      relationships: [
        ...others,
        {
          id: `optimistic:${change.targetId}`,
          user_id: userId,
          friend_id: change.targetId,
          status: "pending",
          created_at: now,
          accepted_at: null,
          profile: change.profile ?? placeholderProfile(change.targetId),
        },
      ],
    };
  }
  if (change.action === "accept" && existing)
    return {
      ...state,
      relationships: [
        ...others,
        { ...existing, status: "accepted", accepted_at: now },
      ],
    };
  return { ...state, relationships: others };
}

// Roll back only this person. Another in-flight action must not be undone.
export function restoreFriendTarget(
  current: FriendsSnapshot,
  previous: FriendsSnapshot,
  targetId: string
): FriendsSnapshot {
  return {
    relationships: [
      ...current.relationships.filter((row) => row.profile.id !== targetId),
      ...previous.relationships.filter((row) => row.profile.id === targetId),
    ],
    blockedIds: [
      ...current.blockedIds.filter((id) => id !== targetId),
      ...previous.blockedIds.filter((id) => id === targetId),
    ],
  };
}

export async function fetchFriendsSnapshot(
  client: SupabaseClient<Database>,
  userId: string,
  signal: AbortSignal
): Promise<FriendsSnapshot> {
  const loadRelationships = async () => {
    const rows: Friendship[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await client
        .from("friendships")
        .select("id, user_id, friend_id, status, created_at, accepted_at")
        .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
        .order("created_at", { ascending: false })
        .order("id")
        .range(offset, offset + 499)
        .abortSignal(signal);
      if (error) throw error;
      rows.push(...((data ?? []) as Friendship[]));
      if (!data || data.length < 500) return rows;
    }
  };
  const loadBlocks = async () => {
    const ids = new Set<string>();
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await client
        .from("user_blocks")
        .select("id, blocker_id, blocked_id")
        .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`)
        .order("id")
        .range(offset, offset + 499)
        .abortSignal(signal);
      if (error) throw error;
      for (const row of data ?? [])
        ids.add(row.blocker_id === userId ? row.blocked_id : row.blocker_id);
      if (!data || data.length < 500) return [...ids];
    }
  };
  const [rows, blockedIds] = await Promise.all([
    loadRelationships(),
    loadBlocks(),
  ]);
  const ids = [
    ...new Set(
      rows.map((row) => (row.user_id === userId ? row.friend_id : row.user_id))
    ),
  ];
  const profiles = new Map<string, FriendProfile>();
  // Bounded chunks keep URLs small and respect the API's row cap.
  for (let offset = 0; offset < ids.length; offset += 200) {
    const { data, error } = await client
      .from("profiles_public")
      .select(
        "id, display_name, full_name, avatar_url, current_rating, gender, handle"
      )
      .in("id", ids.slice(offset, offset + 200))
      .abortSignal(signal);
    if (error) throw error;
    for (const profile of data ?? [])
      if (profile.id) profiles.set(profile.id, profile as FriendProfile);
  }
  return {
    blockedIds,
    relationships: normalizeRelationships(
      rows.map((row) => {
        const id = row.user_id === userId ? row.friend_id : row.user_id;
        return { ...row, profile: profiles.get(id) ?? placeholderProfile(id) };
      }),
      blockedIds
    ),
  };
}
