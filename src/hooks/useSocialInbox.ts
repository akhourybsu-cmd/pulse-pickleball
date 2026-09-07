import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useDirectMessages } from "@/hooks/useDirectMessages";
import { useAuthState } from "@/hooks/useAuthState";
import {
  dmToConversation,
  groupToConversation,
  sortConversations,
  type SocialConversation,
  type GroupLatestMessage,
  type GroupSource,
} from "@/lib/social/inbox";

/**
 * Unified Social inbox — direct messages + group chats normalized into one
 * chronological conversation list. Group state is shared at the player-shell
 * level so the Social badge and inbox use one query/subscription instead of
 * maintaining competing copies.
 */

interface RawLatest {
  content: string;
  image_url: string | null;
  created_at: string;
  senderId: string;
  senderName: string | null;
}

interface InboxGroup extends GroupSource {
  lastChatReadAt: string | null;
}

interface GroupInboxState {
  conversations: SocialConversation[];
  loading: boolean;
  error: string | null;
  totalUnread: number;
  refetch: () => void;
}

export interface SocialInboxState {
  conversations: SocialConversation[];
  loading: boolean;
  error: string | null;
  currentUserId: string | null;
  markRead: (conversationId: string) => void;
  setMuted: (conversationId: string, muted: boolean) => void;
  leaveConversation: (conversationId: string) => void;
  refetch: () => void;
}

const GroupInboxContext = createContext<GroupInboxState | null>(null);
const GROUP_REFRESH_DEBOUNCE_MS = 160;
const EPOCH = "1970-01-01T00:00:00.000Z";

function useGroupInboxState(enabled: boolean): GroupInboxState {
  const { user } = useAuthState();
  const currentUserId = user?.id ?? null;
  const [groups, setGroups] = useState<InboxGroup[]>([]);
  const [latestByGroup, setLatestByGroup] = useState<Map<string, RawLatest>>(new Map());
  const [unreadByGroup, setUnreadByGroup] = useState<Map<string, number>>(new Map());
  const [groupsLoading, setGroupsLoading] = useState(enabled);
  const [messagesLoading, setMessagesLoading] = useState(enabled);
  const [groupsError, setGroupsError] = useState<string | null>(null);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [groupsRefreshVersion, setGroupsRefreshVersion] = useState(0);
  const [messagesRefreshVersion, setMessagesRefreshVersion] = useState(0);
  const groupIdsRef = useRef<Set<string>>(new Set());
  const refreshTimerRef = useRef<number | null>(null);
  const refreshMembershipRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    if (!enabled || !currentUserId) {
      groupIdsRef.current = new Set();
      setGroups([]);
      setGroupsLoading(false);
      setGroupsError(null);
      return;
    }

    setGroupsLoading(true);
    setGroupsError(null);
    void (async () => {
      const { data, error } = await supabase
        .from("group_members")
        .select(`
          group_id,
          last_read_at,
          last_chat_read_at,
          groups!inner (
            id,
            name,
            icon_url,
            member_count,
            updated_at
          )
        `)
        .eq("user_id", currentUserId)
        .eq("status", "active");

      if (cancelled) return;
      if (error) {
        setGroupsError(error.message || "Failed to load group chats");
        setGroupsLoading(false);
        return;
      }

      type GroupRelation = {
        id: string;
        name: string;
        icon_url: string | null;
        member_count: number | null;
        updated_at: string | null;
      };
      type MembershipResult = {
        last_read_at: string | null;
        last_chat_read_at: string | null;
        groups: GroupRelation | GroupRelation[] | null;
      };

      const nextGroups = ((data ?? []) as unknown as MembershipResult[])
        .map((membership): InboxGroup | null => {
          const relation = Array.isArray(membership.groups)
            ? membership.groups[0]
            : membership.groups;
          if (!relation) return null;
          return {
            id: relation.id,
            name: relation.name,
            icon_url: relation.icon_url,
            member_count: relation.member_count ?? 0,
            updated_at: relation.updated_at ?? EPOCH,
            lastChatReadAt: membership.last_chat_read_at ?? membership.last_read_at,
          };
        })
        .filter((group): group is InboxGroup => group !== null);

      groupIdsRef.current = new Set(nextGroups.map((group) => group.id));
      setGroups(nextGroups);
      setGroupsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [currentUserId, enabled, groupsRefreshVersion]);

  const groupIds = useMemo(() => groups.map((group) => group.id), [groups]);
  const groupIdsKey = groupIds.join(",");
  const lastReadKey = groups
    .map((group) => `${group.id}:${group.lastChatReadAt ?? ""}`)
    .join(",");

  useEffect(() => {
    let cancelled = false;

    if (!enabled || !currentUserId || groupIds.length === 0) {
      setLatestByGroup(new Map());
      setUnreadByGroup(new Map());
      setMessagesLoading(false);
      setMessagesError(null);
      return;
    }

    setMessagesLoading(true);
    setMessagesError(null);
    void (async () => {
      const { data, error } = await supabase
        .from("group_messages")
        .select("group_id, content, image_url, created_at, user_id")
        .in("group_id", groupIds)
        .order("created_at", { ascending: false })
        .limit(300);

      if (cancelled) return;
      if (error) {
        setMessagesError(error.message || "Failed to load group messages");
        setMessagesLoading(false);
        return;
      }

      const rows = (data ?? []) as Array<{
        group_id: string;
        content: string;
        image_url: string | null;
        created_at: string | null;
        user_id: string;
      }>;
      const latest = new Map<string, (typeof rows)[number]>();
      for (const row of rows) {
        if (!latest.has(row.group_id)) latest.set(row.group_id, row);
      }

      const lastReadByGroup = new Map(
        groups.map((group) => [group.id, group.lastChatReadAt] as const),
      );
      const unread = new Map<string, number>();
      for (const row of rows) {
        if (row.user_id === currentUserId) continue;
        const lastRead = lastReadByGroup.get(row.group_id);
        const createdAt = row.created_at ?? EPOCH;
        if (!lastRead || createdAt > lastRead) {
          unread.set(row.group_id, (unread.get(row.group_id) ?? 0) + 1);
        }
      }

      const senderIds = Array.from(
        new Set(Array.from(latest.values()).map((row) => row.user_id)),
      );
      const nameById = new Map<string, string>();
      if (senderIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles_public")
          .select("id, display_name, full_name")
          .in("id", senderIds);
        for (const profile of profiles ?? []) {
          nameById.set(
            profile.id,
            profile.display_name || profile.full_name || "Member",
          );
        }
      }

      if (cancelled) return;
      const nextLatest = new Map<string, RawLatest>();
      latest.forEach((row, groupId) => {
        nextLatest.set(groupId, {
          content: row.content,
          image_url: row.image_url,
          created_at: row.created_at ?? EPOCH,
          senderId: row.user_id,
          senderName: nameById.get(row.user_id) ?? null,
        });
      });
      setLatestByGroup(nextLatest);
      setUnreadByGroup(unread);
      setMessagesLoading(false);
    })();

    return () => {
      cancelled = true;
    };
    // groupIdsKey/lastReadKey deliberately represent the exact query inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId, enabled, groupIdsKey, lastReadKey, messagesRefreshVersion]);

  const scheduleRefresh = useCallback((includeMembership: boolean) => {
    refreshMembershipRef.current =
      refreshMembershipRef.current || includeMembership;
    if (refreshTimerRef.current !== null) {
      window.clearTimeout(refreshTimerRef.current);
    }
    refreshTimerRef.current = window.setTimeout(() => {
      const refreshMembership = refreshMembershipRef.current;
      refreshMembershipRef.current = false;
      refreshTimerRef.current = null;
      if (refreshMembership) {
        setGroupsRefreshVersion((version) => version + 1);
      }
      setMessagesRefreshVersion((version) => version + 1);
    }, GROUP_REFRESH_DEBOUNCE_MS);
  }, []);

  const refetch = useCallback(() => {
    if (refreshTimerRef.current !== null) {
      window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    refreshMembershipRef.current = false;
    setGroupsRefreshVersion((version) => version + 1);
    setMessagesRefreshVersion((version) => version + 1);
  }, []);

  useEffect(() => {
    if (!enabled || !currentUserId) return;

    let subscribed = false;
    const channel = supabase
      .channel(`social-group-inbox-${currentUserId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "group_messages" },
        (payload) => {
          const next = payload.new as { group_id?: unknown };
          const previous = payload.old as { group_id?: unknown };
          const groupId =
            typeof next.group_id === "string"
              ? next.group_id
              : typeof previous.group_id === "string"
                ? previous.group_id
                : null;
          if (!groupId || groupIdsRef.current.has(groupId)) {
            scheduleRefresh(false);
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "group_members",
          filter: `user_id=eq.${currentUserId}`,
        },
        () => scheduleRefresh(true),
      )
      .subscribe((status) => {
        if (status !== "SUBSCRIBED") return;
        if (subscribed) scheduleRefresh(true);
        subscribed = true;
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [currentUserId, enabled, scheduleRefresh]);

  useEffect(() => {
    if (!enabled || !currentUserId) return;

    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") scheduleRefresh(true);
    };
    window.addEventListener("focus", refreshIfVisible);
    document.addEventListener("visibilitychange", refreshIfVisible);
    return () => {
      window.removeEventListener("focus", refreshIfVisible);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [currentUserId, enabled, scheduleRefresh]);

  useEffect(
    () => () => {
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current);
      }
    },
    [],
  );

  const conversations = useMemo(
    () =>
      groups.map((group) => {
        const raw = latestByGroup.get(group.id);
        const latest: GroupLatestMessage | null = raw
          ? {
              content: raw.content,
              image_url: raw.image_url,
              created_at: raw.created_at,
              senderName: raw.senderName,
              senderIsMe: raw.senderId === currentUserId,
            }
          : null;
        return groupToConversation(
          group,
          latest,
          unreadByGroup.get(group.id) ?? 0,
        );
      }),
    [currentUserId, groups, latestByGroup, unreadByGroup],
  );
  const totalUnread = useMemo(
    () =>
      conversations.reduce(
        (total, conversation) => total + conversation.unreadCount,
        0,
      ),
    [conversations],
  );

  return useMemo(
    () => ({
      conversations,
      loading: enabled && (groupsLoading || messagesLoading),
      error: groupsError ?? messagesError,
      totalUnread,
      refetch,
    }),
    [
      conversations,
      enabled,
      groupsError,
      groupsLoading,
      messagesError,
      messagesLoading,
      refetch,
      totalUnread,
    ],
  );
}

/**
 * Keeps group previews/unread counts alive once per authenticated player shell.
 * Like the DM provider, it yields the first dashboard paint and starts during
 * browser idle time unless the user opens Social directly.
 */
export function GroupInboxProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const isInboxRoute =
    location.pathname === "/player/social" ||
    location.pathname === "/player/friends" ||
    location.pathname.startsWith("/player/messages");
  const [ready, setReady] = useState(isInboxRoute);

  useEffect(() => {
    if (isInboxRoute) {
      setReady(true);
      return;
    }

    const browserWindow = window as typeof window & {
      requestIdleCallback?: (
        callback: () => void,
        options?: { timeout: number },
      ) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    if (browserWindow.requestIdleCallback) {
      const handle = browserWindow.requestIdleCallback(
        () => setReady(true),
        { timeout: 1800 },
      );
      return () => browserWindow.cancelIdleCallback?.(handle);
    }

    const handle = window.setTimeout(() => setReady(true), 900);
    return () => window.clearTimeout(handle);
  }, [isInboxRoute]);

  const value = useGroupInboxState(ready);
  return createElement(GroupInboxContext.Provider, { value }, children);
}

export function useGroupInboxUnreadCount(): number {
  return useContext(GroupInboxContext)?.totalUnread ?? 0;
}

export function useSocialInbox(): SocialInboxState {
  const dm = useDirectMessages();
  const groupInbox = useContext(GroupInboxContext);
  const groupLoading = groupInbox?.loading ?? false;
  const groupError = groupInbox?.error ?? null;
  const groupRefetch = groupInbox?.refetch;

  const conversations = useMemo(() => {
    const dms = dm.conversations.map((conversation) =>
      dmToConversation(conversation, dm.currentUserId),
    );
    return sortConversations([
      ...dms,
      ...(groupInbox?.conversations ?? []),
    ]);
  }, [dm.conversations, dm.currentUserId, groupInbox?.conversations]);

  const dmRefetch = dm.refetch;
  const refetch = useCallback(() => {
    void dmRefetch();
    groupRefetch?.();
  }, [dmRefetch, groupRefetch]);

  return {
    conversations,
    loading: dm.loading || groupLoading,
    error: dm.error ?? groupError,
    currentUserId: dm.currentUserId,
    markRead: dm.markRead,
    setMuted: dm.setMuted,
    leaveConversation: dm.leaveConversation,
    refetch,
  };
}
