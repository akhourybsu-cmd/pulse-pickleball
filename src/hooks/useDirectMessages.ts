import { useDmInboxState as useDirectMessagesState } from './useDmInbox';
import {
  createContext,
  createElement,
  useState,
  useEffect,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getErrorCode } from '@/lib/getErrorMessage';
import { withAuthDeadline } from '@/lib/authDeadline';
import { toast } from 'sonner';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useLocation } from 'react-router-dom';
import { useAuthState } from '@/hooks/useAuthState';
import {
  mergeDirectMessageRealtime,
  mergeDirectMessageSnapshot,
  reconcileDirectMessageAck,
} from '@/lib/chat/directMessageState';

export interface ConversationParticipant {
  id: string;
  user_id: string;
  display_name: string | null;
  full_name: string | null;
  avatar_url: string | null;
  current_rating: number | null;
}

export interface DirectMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  client_id?: string | null;
  /** Set on optimistic rows pre-server-ACK so the realtime handler can
   *  swap by client id rather than blind-appending a duplicate. */
  _clientId?: string;
  /** Lifecycle: 'sending' while the network request is in flight,
   *  'sent' after server confirms, 'failed' on error (retry-able). */
  _status?: 'sending' | 'sent' | 'failed';
}

export interface ConversationPreview {
  id: string;
  updated_at: string;
  participant: ConversationParticipant;
  lastMessage: DirectMessage | null;
  unreadCount: number;
  isMuted: boolean;
  leftAt: string | null;
}

type DirectMessagesValue = ReturnType<typeof useDirectMessagesState>;
const DirectMessagesContext = createContext<DirectMessagesValue | null>(null);

/** Keep one inbox query + realtime channel alive for the entire player shell. */
export function DirectMessagesProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const isInboxRoute =
    location.pathname === '/player/social' ||
    location.pathname === '/player/friends' ||
    location.pathname.startsWith('/player/messages');
  const [ready, setReady] = useState(isInboxRoute);

  useEffect(() => {
    if (isInboxRoute) {
      setReady(true);
      return;
    }

    // Inbox previews are useful globally for the badge, but they should not
    // compete with auth + dashboard data during first paint. Start them as
    // soon as the browser is idle (or shortly after on older webviews).
    const browserWindow = window as typeof window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    if (browserWindow.requestIdleCallback) {
      const handle = browserWindow.requestIdleCallback(() => setReady(true), { timeout: 1800 });
      return () => browserWindow.cancelIdleCallback?.(handle);
    }

    const handle = window.setTimeout(() => setReady(true), 900);
    return () => window.clearTimeout(handle);
  }, [isInboxRoute]);

  const value = useDirectMessagesState(ready);
  return createElement(DirectMessagesContext.Provider, { value }, children);
}

export function useDirectMessages(): DirectMessagesValue {
  const shared = useContext(DirectMessagesContext);
  // The disabled fallback preserves standalone use in isolated component
  // harnesses while avoiding duplicate requests inside the player provider.
  const standalone = useDirectMessagesState(shared === null);
  return shared ?? standalone;
}

// How many messages to load per page. The thread opens on the newest page
// and pulls older messages on demand (no more fetching an entire history).
const DM_PAGE_SIZE = 40;

export function useConversation(conversationId: string | null) {
  const { user } = useAuthState();
  const userId = user?.id ?? null;
  // Token refreshes replace the User object. Only a different account or
  // conversation should reset the thread, its scroll position, and subscription.
  const scope = useMemo(() => ({ key: `${userId}:${conversationId}` }), [userId, conversationId]);
  const activeScopeRef = useRef<typeof scope | null>(scope);
  activeScopeRef.current = scope;
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [participant, setParticipant] = useState<ConversationParticipant | null>(null);
  const [viewerMembership, setViewerMembership] = useState<{
    isMuted: boolean;
    leftAt: string | null;
  } | null>(null);
  // True when the conversation has no other participant visible to this
  // user — an invalid id, or a conversation they're not part of (RLS
  // returns zero rows for both cases). Without this the page rendered
  // an empty chat with "Player" as the header, indistinguishable from
  // a real conversation.
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadedScopeKey, setLoadedScopeKey] = useState<string | null>(null);
  const [resolvedParticipantScope, setResolvedParticipantScope] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const fetchSequenceRef = useRef(0);

  const fetchMessages = useCallback(async () => {
    if (!conversationId || !userId || activeScopeRef.current !== scope) return;
    const requestedConversationId = conversationId;
    const requestSequence = ++fetchSequenceRef.current;
    setRefreshing(true);
    try {
      await withAuthDeadline(async (signal) => {

        // Newest page (descending + limit), reversed to chronological order for
        // display. Older messages are pulled in via loadOlder().
        const { data, error } = await supabase
          .from('direct_messages')
          .select('*')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: false })
          .limit(DM_PAGE_SIZE).abortSignal(signal);
        if (error) throw error;
        if (
          signal.aborted || activeScopeRef.current !== scope ||
          fetchSequenceRef.current !== requestSequence
        ) return;

        const serverMessages = ((data || []).slice().reverse()) as DirectMessage[];
        setMessages((previous) => mergeDirectMessageSnapshot(
          previous.filter(
            (message) => message.conversation_id === requestedConversationId,
          ),
          serverMessages,
        ));
        setLoadedScopeKey(scope.key);
        setHasMore((data || []).length === DM_PAGE_SIZE);

        const { data: participants, error: participantsError } = await supabase
          .from('conversation_participants')
          .select('user_id, is_muted, left_at')
          .eq('conversation_id', conversationId).abortSignal(signal);
        if (participantsError) throw participantsError;
        if (signal.aborted || activeScopeRef.current !== scope || fetchSequenceRef.current !== requestSequence) return;

        // A departed viewer is still allowed to read the retained history, and
        // the thread UI renders that state with a disabled composer. Confirm the
        // viewer's membership explicitly (instead of relying only on RLS), then
        // keep the other participant lookup independent of either person's
        // left_at value so historical threads retain the correct identity.
        const viewer = participants?.find((entry) => entry.user_id === userId);
        const other = participants?.find((entry) => entry.user_id !== userId);

        if (viewer && other) {
          const otherId = other.user_id;
          const { data: profile, error: profileError } = await supabase
            .from('profiles_public')
            .select('id, display_name, full_name, avatar_url, current_rating')
            .eq('id', otherId)
            .abortSignal(signal).maybeSingle();
          if (profileError) throw profileError;
          if (
            signal.aborted || activeScopeRef.current !== scope ||
            fetchSequenceRef.current !== requestSequence
          ) return;
          setParticipant({
            id: otherId,
            user_id: otherId,
            display_name: profile?.display_name ?? null,
            full_name: profile?.full_name ?? null,
            avatar_url: profile?.avatar_url ?? null,
            current_rating: profile?.current_rating ?? null,
          });
          setViewerMembership({
            isMuted: !!viewer.is_muted,
            leftAt: viewer.left_at,
          });
          setResolvedParticipantScope(scope.key);
          setNotFound(false);
          setLoadError(false);
        } else {
          if (
            activeScopeRef.current === scope &&
            fetchSequenceRef.current === requestSequence
          ) {
            setResolvedParticipantScope(scope.key);
            setNotFound(true);
            setLoadError(false);
          }
        }
      });
    } catch (error: unknown) {
      console.error('Error fetching messages:', error);
      // Malformed id in the URL (not a uuid) errors before the
      // participant check runs — treat it as not-found, not a chat.
      if (
        activeScopeRef.current === scope &&
        fetchSequenceRef.current === requestSequence
      ) {
        setLoadedScopeKey(scope.key);
        setResolvedParticipantScope(scope.key);
        if (getErrorCode(error) === '22P02') setNotFound(true);
        else setLoadError(true);
      }
    } finally {
      if (
        activeScopeRef.current === scope &&
        fetchSequenceRef.current === requestSequence
      ) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [conversationId, userId, scope]);

  useEffect(() => {
    activeScopeRef.current = scope;
    fetchSequenceRef.current += 1;
    setMessages([]);
    setParticipant(null);
    setViewerMembership(null);
    setNotFound(false);
    setLoadError(false);
    setRefreshing(false);
    setLoadedScopeKey(null);
    setResolvedParticipantScope(null);
    setHasMore(false);
    setLoadingOlder(false);
    setLoading(!!conversationId);
    if (!conversationId || !userId) {
      setLoading(false);
      return;
    }

    void fetchMessages();

    const channel = supabase
      .channel(`dm-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const incoming = payload.new as DirectMessage;
          if (activeScopeRef.current !== scope) return;
          setMessages((previous) => mergeDirectMessageRealtime(previous, incoming));
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED' && activeScopeRef.current === scope) {
          // Close the fetch/subscription race and catch anything the socket
          // could not replay while reconnecting.
          void fetchMessages();
        }
      });
    channelRef.current = channel;

    return () => {
      if (activeScopeRef.current === scope) activeScopeRef.current = null;
      fetchSequenceRef.current += 1;
      if (channelRef.current === channel) channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [conversationId, fetchMessages, userId, scope]);

  const recoverAcknowledgedMessage = useCallback(async (clientId: string): Promise<boolean> => {
    if (!conversationId || !userId || activeScopeRef.current !== scope) return false;
    try {
      const { data, error } = await withAuthDeadline(signal => supabase
        .from('direct_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .eq('sender_id', userId)
        .eq('client_id', clientId)
        .abortSignal(signal).maybeSingle());
      if (error || !data || activeScopeRef.current !== scope) return false;
      setMessages((previous) =>
        reconcileDirectMessageAck(previous, data as DirectMessage, clientId),
      );
      return true;
    } catch {
      return false;
    }
  }, [conversationId, userId, scope]);

  // Optimistic send — matches the useGroupChat pattern so DMs feel as
  // snappy as group messages. Pre-conversion the caller awaited the
  // server round-trip while the input was disabled and a spinner spun
  // on the send button; now we insert the message into local state
  // synchronously with _status='sending', return immediately so the
  // composer can clear, and let the network INSERT happen in the
  // background. The realtime INSERT handler (see useEffect above)
  // swaps the temp row for the server row on confirmation. On error
  // the temp row flips to _status='failed' so the bubble can show a
  // "tap to retry" affordance.
  const sendMessage = useCallback(async (content: string): Promise<boolean> => {
    const trimmed = content.trim();
    if (!conversationId || !trimmed || activeScopeRef.current !== scope) return false;
    if (!userId) {
      toast.error('Not authenticated');
      return false;
    }

    const clientId = crypto.randomUUID();
    const optimistic: DirectMessage = {
      id: `temp-${clientId}`,
      conversation_id: conversationId,
      sender_id: userId,
      content: trimmed,
      created_at: new Date().toISOString(),
      client_id: clientId,
      _clientId: clientId,
      _status: 'sending',
    };
    setMessages(prev => [...prev, optimistic]);

    // Fire-and-await the network in the background. We don't block the
    // caller — sendMessage resolves "true" once the optimistic row is
    // on screen, which is what the composer needs to clear its input.
    (async () => {
      try {
        const { data, error } = await supabase
          .from('direct_messages')
          .insert({
            conversation_id: conversationId,
            sender_id: userId,
            content: trimmed,
            client_id: clientId,
          })
          .select('*')
          .single();
        if (error) throw error;
        if (activeScopeRef.current !== scope) return;
        setMessages((previous) =>
          reconcileDirectMessageAck(previous, data as DirectMessage, clientId),
        );
      } catch (error) {
        if (activeScopeRef.current !== scope) return;
        // The request can lose its response after Postgres committed the row.
        // Resolve by the idempotency key before presenting a false failure.
        if (await recoverAcknowledgedMessage(clientId)) return;
        console.error('Error sending message:', error);
        // Mark the optimistic row failed so the UI can offer a retry.
        if (activeScopeRef.current === scope) {
          setMessages(prev =>
            prev.map(m => (m._clientId === clientId ? { ...m, _status: 'failed' as const } : m)),
          );
        }
        toast.error('Failed to send message');
      }
    })();

    return true;
  }, [conversationId, recoverAcknowledgedMessage, userId, scope]);

  // Retry a failed send by re-firing the network insert for an existing
  // optimistic row. Same dedupe rules apply — realtime swap finishes
  // the job once the server confirms.
  const retryMessage = useCallback(async (clientId: string): Promise<void> => {
    if (!conversationId || activeScopeRef.current !== scope) return;
    const target = messages.find((m) => m._clientId === clientId && m._status === 'failed');
    if (!target) return;
    if (!userId) return;
    // Flip back to 'sending' for the spinner / pulse.
    setMessages(prev => prev.map(m => (m._clientId === clientId ? { ...m, _status: 'sending' as const } : m)));
    try {
      const { data, error } = await supabase
        .from('direct_messages')
        .insert({
          conversation_id: conversationId,
          sender_id: userId,
          content: target.content,
          client_id: clientId,
        })
        .select('*')
        .single();
      if (error) throw error;
      if (activeScopeRef.current !== scope) return;
      setMessages((previous) =>
        reconcileDirectMessageAck(previous, data as DirectMessage, clientId),
      );
    } catch (error) {
      if (activeScopeRef.current !== scope) return;
      // Retrying the same client id may hit the unique constraint when the
      // original request committed but its response was lost. In that case,
      // recover the existing row and treat it as delivered.
      if (await recoverAcknowledgedMessage(clientId)) return;
      console.error('Error retrying message:', error);
      if (activeScopeRef.current === scope) {
        setMessages(prev => prev.map(m => (m._clientId === clientId ? { ...m, _status: 'failed' as const } : m)));
      }
      toast.error('Failed to send message');
    }
  }, [conversationId, messages, recoverAcknowledgedMessage, userId, scope]);

  // Pull the previous page of (older) messages and prepend them. Keyed on the
  // oldest currently-loaded real message's timestamp; dedupes by id defensively.
  const loadOlder = useCallback(async () => {
    if (!conversationId || !userId || activeScopeRef.current !== scope) return;
    const oldest = messages.find((m) => !m._clientId) ?? messages[0];
    if (!oldest) return;
    setLoadingOlder(true);
    try {
      const { data, error } = await withAuthDeadline(signal => supabase
        .from('direct_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .lt('created_at', oldest.created_at)
        .order('created_at', { ascending: false })
        .limit(DM_PAGE_SIZE).abortSignal(signal));
      if (error) throw error;
      if (activeScopeRef.current !== scope) return;
      const older = (data || []).slice().reverse();
      if (older.length) {
        setMessages((prev) => {
          const existing = new Set(prev.map((m) => m.id));
          const fresh = older.filter((m) => !existing.has(m.id));
          return [...fresh, ...prev];
        });
      }
      setHasMore((data || []).length === DM_PAGE_SIZE);
    } catch (error) {
      console.error('Error loading older messages:', error);
    } finally {
      if (activeScopeRef.current === scope) {
        setLoadingOlder(false);
      }
    }
  }, [conversationId, messages, userId, scope]);

  const visibleMessages = useMemo(
    () => userId && loadedScopeKey === scope.key
      ? messages.filter((message) => message.conversation_id === conversationId) : [],
    [conversationId, messages, loadedScopeKey, scope, userId],
  );

  return {
    messages: visibleMessages,
    loading: !!userId && !!conversationId && (loading ||
      loadedScopeKey !== scope.key || resolvedParticipantScope !== scope.key),
    loadError: resolvedParticipantScope === scope.key && loadError,
    refreshing,
    hasMore,
    loadingOlder,
    loadOlder,
    participant: resolvedParticipantScope === scope.key ? participant : null,
    viewerMembership: resolvedParticipantScope === scope.key ? viewerMembership : null,
    currentUserId: userId,
    notFound: resolvedParticipantScope === scope.key && notFound,
    sendMessage,
    retryMessage,
    channelRef,
    refetch: fetchMessages,
  };
}
