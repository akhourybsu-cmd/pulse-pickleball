import { useCallback, useEffect, useMemo } from "react";
import {
  useMutation,
  useMutationState,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuthState } from "@/hooks/useAuthState";
import {
  emptyFriends,
  fetchFriendsSnapshot,
  friendActionKey,
  friendName,
  friendsKey,
  optimisticFriendChange,
  restoreFriendTarget,
  type FriendChange,
  type FriendProfile,
  type FriendsSnapshot,
} from "@/lib/social/friends";
export type {
  FriendProfile,
  Friendship,
  FriendWithProfile,
  FriendRequest,
} from "@/lib/social/friends";

const locks = new WeakMap<QueryClient, Set<string>>();
const subscriptions = new WeakMap<
  QueryClient,
  Map<string, { count: number; dispose: () => void }>
>();

// A single subscription feeds every friends surface, including the dashboard.
function subscribeToFriends(client: QueryClient, userId: string) {
  let registry = subscriptions.get(client);
  if (!registry) {
    registry = new Map();
    subscriptions.set(client, registry);
  }
  let entry = registry.get(userId);
  if (!entry) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (client.isMutating({ mutationKey: friendActionKey(userId) })) return;
        void client.invalidateQueries(
          { queryKey: friendsKey(userId) },
          { cancelRefetch: false }
        );
        void client.invalidateQueries({
          queryKey: ["friend-suggestions", userId],
        });
      }, 180);
    };
    const channel = supabase
      .channel(`friends:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "friendships",
          filter: `user_id=eq.${userId}`,
        },
        refresh
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "friendships",
          filter: `friend_id=eq.${userId}`,
        },
        refresh
      )
      // Deleted rows have only their primary key; recipient filters cannot
      // match them. Reconcile only ids already in this account's cache.
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "friendships" },
        (payload) => {
          if (
            client
              .getQueryData<FriendsSnapshot>(friendsKey(userId))
              ?.relationships.some((row) => row.id === payload.old.id)
          )
            refresh();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_blocks",
          filter: `blocker_id=eq.${userId}`,
        },
        refresh
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_blocks",
          filter: `blocked_id=eq.${userId}`,
        },
        refresh
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED" && client.getQueryData(friendsKey(userId)))
          refresh();
      });
    entry = {
      count: 0,
      dispose: () => {
        clearTimeout(timer);
        void supabase.removeChannel(channel);
      },
    };
    registry.set(userId, entry);
  }
  entry.count++;
  return () => {
    if (--entry.count === 0) {
      entry.dispose();
      registry.delete(userId);
    }
  };
}

export function useFriends(options?: {
  realtime?: boolean;
  includeSent?: boolean;
  enabled?: boolean;
}) {
  const { user, loading: authLoading } = useAuthState();
  const currentUserId = user?.id ?? null;
  const client = useQueryClient();
  const enabled = !!currentUserId && (options?.enabled ?? true);
  const key = friendsKey(currentUserId);
  const mutationKey = friendActionKey(currentUserId);
  const query = useQuery({
    queryKey: key,
    queryFn: ({ signal }) =>
      fetchFriendsSnapshot(supabase, currentUserId!, signal),
    enabled,
    staleTime: 30_000,
    refetchInterval: () =>
      client.isMutating({ mutationKey }) ? false : 60_000,
    refetchOnWindowFocus: () => !client.isMutating({ mutationKey }),
    refetchOnReconnect: () => !client.isMutating({ mutationKey }),
  });
  useEffect(() => {
    if (!enabled || options?.realtime === false) return;
    return subscribeToFriends(client, currentUserId!);
  }, [client, currentUserId, enabled, options?.realtime]);

  const mutation = useMutation({
    mutationKey,
    mutationFn: async (change: FriendChange) => {
      if (!currentUserId) throw new Error("Please sign in again.");
      if (change.action === "send") {
        const { data, error } = await supabase.rpc("send_friend_request", {
          p_friend_id: change.targetId,
        });
        if (error) throw error;
        return data;
      }
      if (change.action === "block") {
        const { error } = await supabase.rpc("block_player", {
          p_user_id: change.targetId,
        });
        if (error) throw error;
        return "blocked";
      }
      if (!change.friendshipId || change.friendshipId.startsWith("optimistic:"))
        throw new Error("This request is still syncing. Please try again.");
      if (change.action === "accept") {
        const { data, error } = await supabase
          .from("friendships")
          .update({ status: "accepted", accepted_at: new Date().toISOString() })
          .eq("id", change.friendshipId)
          .eq("friend_id", currentUserId)
          .eq("status", "pending")
          .select("id")
          .maybeSingle();
        if (error) throw error;
        if (!data)
          throw new Error(
            "This request has changed. Your list has been refreshed."
          );
        return "accepted";
      }
      let request = supabase
        .from("friendships")
        .delete()
        .eq("id", change.friendshipId)
        .eq("status", change.action === "remove" ? "accepted" : "pending");
      if (change.action === "cancel")
        request = request.eq("user_id", currentUserId);
      if (change.action === "decline")
        request = request.eq("friend_id", currentUserId);
      const { data, error } = await request.select("id").maybeSingle();
      if (error) throw error;
      if (!data)
        throw new Error(
          "This connection has changed. Your list has been refreshed."
        );
      return "removed";
    },
    onMutate: async (change) => {
      await client.cancelQueries({ queryKey: key });
      const previous =
        client.getQueryData<FriendsSnapshot>(key) ?? emptyFriends();
      client.setQueryData(
        key,
        optimisticFriendChange(
          previous,
          change,
          currentUserId!,
          new Date().toISOString()
        )
      );
      return previous;
    },
    onError: (error, change, previous) => {
      if (previous)
        client.setQueryData<FriendsSnapshot>(key, (current) =>
          restoreFriendTarget(
            current ?? emptyFriends(),
            previous,
            change.targetId
          )
        );
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not update this connection. Please try again."
      );
    },
    onSuccess: (status, change) => {
      const messages = {
        send:
          status === "accepted" ? "You're now friends!" : "Friend request sent",
        accept: "You're now friends!",
        decline: "Request declined",
        cancel: "Request canceled",
        remove: "Friend removed",
        block: "Player blocked",
      };
      toast.success(messages[change.action]);
    },
    onSettled: async () => {
      // The last concurrent write reconciles everything; earlier responses must
      // not overwrite another person's optimistic update.
      if (client.isMutating({ mutationKey }) <= 1)
        await Promise.all([
          client.invalidateQueries({ queryKey: key }),
          client.invalidateQueries({
            queryKey: ["friend-suggestions", currentUserId],
          }),
          client.invalidateQueries({
            queryKey: ["user-blocks", currentUserId],
          }),
        ]);
    },
  });
  const pendingTargets = useMutationState({
    filters: { mutationKey, status: "pending" },
    select: (item) => (item.state.variables as FriendChange).targetId,
  });
  const isPending = useCallback(
    (userId: string) => pendingTargets.includes(userId),
    [pendingTargets]
  );
  const run = async (change: FriendChange) => {
    if (!currentUserId || change.targetId === currentUserId) return false;
    let active = locks.get(client);
    if (!active) {
      active = new Set();
      locks.set(client, active);
    }
    const lock = `${currentUserId}:${change.targetId}`;
    if (active.has(lock)) return false;
    active.add(lock);
    try {
      await mutation.mutateAsync(change);
      return true;
    } catch {
      return false;
    } finally {
      active.delete(lock);
    }
  };
  const byId = (action: FriendChange["action"], friendshipId: string) => {
    const row = client
      .getQueryData<FriendsSnapshot>(key)
      ?.relationships.find((item) => item.id === friendshipId);
    return row
      ? run({ action, targetId: row.profile.id, friendshipId })
      : Promise.resolve(false);
  };
  const state = query.data ?? emptyFriends();
  const friends = useMemo(
    () =>
      state.relationships
        .filter((row) => row.status === "accepted")
        .sort((a, b) =>
          friendName(a.profile).localeCompare(friendName(b.profile))
        ),
    [state.relationships]
  );
  const pendingRequests = useMemo(
    () =>
      state.relationships
        .filter(
          (row) => row.status === "pending" && row.friend_id === currentUserId
        )
        .map((row) => ({
          id: row.id,
          user_id: row.user_id,
          created_at: row.created_at,
          profile: row.profile,
        })),
    [state.relationships, currentUserId]
  );
  const sentRequests = useMemo(
    () =>
      state.relationships
        .filter(
          (row) => row.status === "pending" && row.user_id === currentUserId
        )
        .map((row) => ({
          id: row.id,
          user_id: row.friend_id,
          created_at: row.created_at,
          profile: row.profile,
        })),
    [state.relationships, currentUserId]
  );
  const getFriendshipStatus = useCallback(
    (
      userId: string
    ):
      | "none"
      | "pending_sent"
      | "pending_received"
      | "accepted"
      | "blocked" => {
      if (state.blockedIds.includes(userId)) return "blocked";
      const row = state.relationships.find(
        (item) => item.profile.id === userId
      );
      if (!row) return "none";
      if (row.status !== "pending") return row.status;
      return row.user_id === currentUserId
        ? "pending_sent"
        : "pending_received";
    },
    [state, currentUserId]
  );

  return {
    friends,
    pendingRequests,
    sentRequests,
    currentUserId,
    isPending,
    loading: authLoading || (enabled && query.isPending),
    error: query.isError
      ? "Could not load your connections. Check your connection and try again."
      : null,
    sendFriendRequest: (friendId: string, profile?: FriendProfile) =>
      run({ action: "send", targetId: friendId, profile }),
    acceptRequest: (id: string) => byId("accept", id),
    declineRequest: (id: string) => byId("decline", id),
    cancelRequest: (id: string) => byId("cancel", id),
    removeFriend: (id: string) => byId("remove", id),
    blockUser: (id: string) => run({ action: "block", targetId: id }),
    getFriendshipStatus,
    refetch: query.refetch,
  };
}
