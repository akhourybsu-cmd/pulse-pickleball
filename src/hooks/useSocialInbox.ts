import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getErrorMessage } from '@/lib/getErrorMessage';
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

interface GroupInboxState {
  conversations: SocialConversation[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  totalUnread: number;
  refetch: () => void;
}

export interface SocialInboxState {
  conversations: SocialConversation[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  currentUserId: string | null;
  markRead: (conversationId: string) => Promise<boolean>;
  setMuted: (conversationId: string, muted: boolean) => Promise<boolean>;
  leaveConversation: (conversationId: string) => Promise<boolean>;
  refetch: () => void;
}

const GroupInboxContext = createContext<GroupInboxState | null>(null);
const GROUP_REFRESH_DEBOUNCE_MS = 160;

function useGroupInboxState(enabled: boolean): GroupInboxState {
  const { user } = useAuthState();
  const userId = user?.id ?? null;
  const client = useQueryClient();
  const key = useMemo(() => ['group-inbox', userId], [userId]);
  const query = useQuery({
    queryKey: key, enabled: enabled && !!userId, staleTime: 30_000, refetchOnWindowFocus: false,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.rpc('social_group_inbox' as never).abortSignal(signal);
      if (error) throw error;
      return (data ?? []) as unknown as Array<GroupSource & { last_message: GroupLatestMessage | null; unread_count: number }>;
    },
  });
  const refetch = useCallback(() => { void client.invalidateQueries({ queryKey: key }); }, [client, key]);
  const conversations = useMemo(() => userId ? (query.data ?? []).map(row => groupToConversation(row, row.last_message, row.unread_count)) : [], [query.data, userId]);
  const groupIdsRef = useRef(new Set<string>());
  groupIdsRef.current = new Set(conversations.map(row => row.id));
  useEffect(() => {
    if (!enabled || !userId) return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => { clearTimeout(timer); timer = setTimeout(refetch, GROUP_REFRESH_DEBOUNCE_MS); };
    const visible = () => { if (document.visibilityState === 'visible') schedule(); };
    let connected = false;
    const channel = supabase.channel('social-group-inbox-' + userId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_messages' }, payload => {
        const groupId = (payload.new as { group_id?: string }).group_id ?? (payload.old as { group_id?: string }).group_id;
        if (!groupId || groupIdsRef.current.has(groupId)) schedule();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_members', filter: 'user_id=eq.' + userId }, schedule)
      .subscribe(status => { if (status === 'SUBSCRIBED') { if (connected) schedule(); connected = true; } });
    window.addEventListener('online', schedule);
    document.addEventListener('visibilitychange', visible);
    return () => { clearTimeout(timer); window.removeEventListener('online', schedule);
      document.removeEventListener('visibilitychange', visible); void supabase.removeChannel(channel); };
  }, [enabled, userId, refetch]);
  return { conversations, loading: enabled && !!userId && query.isPending,
    refreshing: query.isFetching && !query.isPending,
    error: query.error ? getErrorMessage(query.error, 'Could not refresh community chats.') : null,
    totalUnread: conversations.reduce((sum, row) => sum + row.unreadCount, 0), refetch };
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
    refreshing: dm.refreshing || !!groupInbox?.refreshing,
    error: dm.error ?? groupError,
    currentUserId: dm.currentUserId,
    markRead: dm.markRead,
    setMuted: dm.setMuted,
    leaveConversation: dm.leaveConversation,
    refetch,
  };
}
