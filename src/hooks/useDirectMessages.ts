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
import { getErrorMessage, getErrorCode } from '@/lib/getErrorMessage';
import { toast } from 'sonner';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useLocation } from 'react-router-dom';
import { interpretDmError } from '@/lib/dmErrors';
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

function useDirectMessagesState(enabled = true) {
  const { user } = useAuthState();
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalUnread, setTotalUnread] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const conversationsRef = useRef(conversations);
  conversationsRef.current = conversations;

  const fetchConversations = useCallback(async () => {
    try {
      setError(null);
      if (!user) {
        setConversations([]);
        setLoading(false);
        return;
      }
      setCurrentUserId(user.id);

      // 1. My participations
      const { data: mine, error: mineErr } = await supabase
        .from('conversation_participants')
        .select('conversation_id, last_read_at, is_muted, left_at')
        .eq('user_id', user.id)
        .is('left_at', null);
      if (mineErr) throw mineErr;
      if (!mine || mine.length === 0) {
        setConversations([]);
        setTotalUnread(0);
        setLoading(false);
        return;
      }

      const convoIds = mine.map(m => m.conversation_id);
      const myMeta = new Map(mine.map(m => [m.conversation_id, m]));

      // The remaining inbox data is independent once we have the ids. Fetch
      // it concurrently so cold-start latency is one round trip rather than
      // three serial waits.
      const [conversationResult, participantResult, messageResult] = await Promise.all([
        supabase
          .from('conversations')
          .select('id, updated_at')
          .in('id', convoIds)
          .order('updated_at', { ascending: false }),
        supabase
          .from('conversation_participants')
          .select('conversation_id, user_id')
          .in('conversation_id', convoIds)
          .neq('user_id', user.id),
        supabase
          .from('direct_messages')
          .select('id, conversation_id, sender_id, content, created_at')
          .in('conversation_id', convoIds)
          .order('created_at', { ascending: false })
          .limit(500),
      ]);

      const { data: convos, error: convErr } = conversationResult;
      if (convErr) throw convErr;

      const { data: others, error: othersErr } = participantResult;
      if (othersErr) throw othersErr;
      const otherByConvo = new Map<string, string>();
      for (const o of others || []) {
        if (!otherByConvo.has(o.conversation_id)) {
          otherByConvo.set(o.conversation_id, o.user_id);
        }
      }
      const otherUserIds = Array.from(new Set(otherByConvo.values()));

      // 4. Profiles in one shot
      const profileMap = new Map<
        string,
        Pick<ConversationParticipant, 'id' | 'display_name' | 'full_name' | 'avatar_url' | 'current_rating'>
      >();
      if (otherUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles_public')
          .select('id, display_name, full_name, avatar_url, current_rating')
          .in('id', otherUserIds);
        for (const p of profiles || []) profileMap.set(p.id, p);
      }

      // Recent messages for those conversations (recent first);
      // reduce client-side. Bounded — an unbounded fetch pulls every
      // message the user has ever exchanged just to derive previews.
      // 500 covers the last message per conversation and keeps unread
      // badges accurate for any realistic backlog (worst case a badge
      // under-counts on a 500+ message backlog, which reads as "lots").
      const { data: allMessages, error: msgErr } = messageResult;
      if (msgErr) throw msgErr;

      const lastByConvo = new Map<string, DirectMessage>();
      const unreadByConvo = new Map<string, number>();
      for (const m of allMessages || []) {
        if (!lastByConvo.has(m.conversation_id)) {
          lastByConvo.set(m.conversation_id, m as DirectMessage);
        }
        if (m.sender_id !== user.id) {
          const meta = myMeta.get(m.conversation_id);
          const lastRead = meta?.last_read_at;
          if (!lastRead || new Date(m.created_at) > new Date(lastRead)) {
            unreadByConvo.set(m.conversation_id, (unreadByConvo.get(m.conversation_id) || 0) + 1);
          }
        }
      }

      // Conversations whose last message fell outside the 500-row
      // window (quiet threads next to a very chatty one) still need a
      // preview — fetch just their latest message individually. Unread
      // badges for these can undercount only when 500+ newer messages
      // exist elsewhere, which already reads as "lots unread".
      const staleConvoIds = convoIds.filter((id) => !lastByConvo.has(id));
      if (staleConvoIds.length > 0) {
        const staleLasts = await Promise.all(
          staleConvoIds.map((id) =>
            supabase
              .from('direct_messages')
              .select('id, conversation_id, sender_id, content, created_at')
              .eq('conversation_id', id)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle()
          )
        );
        for (const { data: m } of staleLasts) {
          if (m) lastByConvo.set(m.conversation_id, m as DirectMessage);
        }
      }

      let unreadTotal = 0;
      const previews: ConversationPreview[] = [];
      for (const convo of convos || []) {
        const otherId = otherByConvo.get(convo.id);
        if (!otherId) continue;
        const profile = profileMap.get(otherId);
        const meta = myMeta.get(convo.id);
        const unread = unreadByConvo.get(convo.id) || 0;
        unreadTotal += unread;
        previews.push({
          id: convo.id,
          updated_at: convo.updated_at,
          participant: {
            id: otherId,
            user_id: otherId,
            display_name: profile?.display_name ?? null,
            full_name: profile?.full_name ?? null,
            avatar_url: profile?.avatar_url ?? null,
            current_rating: profile?.current_rating ?? null,
          },
          lastMessage: lastByConvo.get(convo.id) || null,
          unreadCount: unread,
          isMuted: !!meta?.is_muted,
          leftAt: meta?.left_at ?? null,
        });
      }

      setConversations(previews);
      setTotalUnread(unreadTotal);
    } catch (e: unknown) {
      console.error('Error fetching conversations:', e);
      setError(getErrorMessage(e, 'Failed to load conversations'));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!enabled || !user) return;

    void fetchConversations();
    channelRef.current = supabase
      .channel('dm-inbox-updates')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'direct_messages' },
        () => { void fetchConversations(); }
      )
      .subscribe();

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [enabled, fetchConversations, user]);

  const startConversation = useCallback(async (otherUserId: string): Promise<string | null> => {
    try {
      const { data, error: rpcErr } = await supabase.rpc('get_or_create_dm_conversation', {
        other_user_id: otherUserId,
      });
      if (rpcErr) throw rpcErr;
      await fetchConversations();
      return data as string;
    } catch (err) {
      console.error('Error starting conversation:', err);
      toast.error(interpretDmError(err));
      return null;
    }
  }, [fetchConversations]);

  const markRead = useCallback(async (conversationId: string) => {
    if (!user) return false;
    const { error } = await supabase
      .from('conversation_participants')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id);
    if (error) {
      console.error('Error marking conversation read:', error);
      return false;
    }
    setConversations(prev => prev.map(c =>
      c.id === conversationId ? { ...c, unreadCount: 0 } : c
    ));
    setTotalUnread(prev => {
      const target = conversationsRef.current.find(c => c.id === conversationId);
      return Math.max(0, prev - (target?.unreadCount || 0));
    });
    return true;
  }, [user]);

  const setMuted = useCallback(async (conversationId: string, muted: boolean) => {
    if (!user) return false;
    const { error: e } = await supabase
      .from('conversation_participants')
      .update({ is_muted: muted })
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id);
    if (e) { toast.error('Failed to update mute'); return false; }
    setConversations(prev => prev.map(c =>
      c.id === conversationId ? { ...c, isMuted: muted } : c
    ));
    toast.success(muted ? 'Conversation muted' : 'Conversation unmuted');
    return true;
  }, [user]);

  const leaveConversation = useCallback(async (conversationId: string) => {
    if (!user) return false;
    const { error: e } = await supabase
      .from('conversation_participants')
      .update({ left_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id);
    if (e) { toast.error('Failed to leave conversation'); return false; }
    setConversations(prev => prev.filter(c => c.id !== conversationId));
    toast.success('You left the conversation');
    return true;
  }, [user]);

  return {
    conversations,
    loading,
    error,
    totalUnread,
    currentUserId,
    startConversation,
    markRead,
    setMuted,
    leaveConversation,
    refetch: fetchConversations,
  };
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
  const [loadedConversationId, setLoadedConversationId] = useState<string | null>(null);
  const [resolvedParticipantFor, setResolvedParticipantFor] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const activeConversationRef = useRef(conversationId);
  const fetchSequenceRef = useRef(0);
  activeConversationRef.current = conversationId;

  const fetchMessages = useCallback(async () => {
    if (!conversationId) return;
    const requestedConversationId = conversationId;
    const requestSequence = ++fetchSequenceRef.current;
    try {
      if (!user) return;

      // Newest page (descending + limit), reversed to chronological order for
      // display. Older messages are pulled in via loadOlder().
      const { data, error } = await supabase
        .from('direct_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(DM_PAGE_SIZE);
      if (error) throw error;
      if (
        activeConversationRef.current !== requestedConversationId ||
        fetchSequenceRef.current !== requestSequence
      ) return;

      const serverMessages = ((data || []).slice().reverse()) as DirectMessage[];
      setMessages((previous) => mergeDirectMessageSnapshot(
        previous.filter(
          (message) => message.conversation_id === requestedConversationId,
        ),
        serverMessages,
      ));
      setLoadedConversationId(requestedConversationId);
      setHasMore((data || []).length === DM_PAGE_SIZE);

      const { data: participants, error: participantsError } = await supabase
        .from('conversation_participants')
        .select('user_id, is_muted, left_at')
        .eq('conversation_id', conversationId);
      if (participantsError) throw participantsError;

      // A departed viewer is still allowed to read the retained history, and
      // the thread UI renders that state with a disabled composer. Confirm the
      // viewer's membership explicitly (instead of relying only on RLS), then
      // keep the other participant lookup independent of either person's
      // left_at value so historical threads retain the correct identity.
      const viewer = participants?.find((entry) => entry.user_id === user.id);
      const other = participants?.find((entry) => entry.user_id !== user.id);

      if (viewer && other) {
        const otherId = other.user_id;
        const { data: profile } = await supabase
          .from('profiles_public')
          .select('id, display_name, full_name, avatar_url, current_rating')
          .eq('id', otherId)
          .maybeSingle();
        if (
          activeConversationRef.current !== requestedConversationId ||
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
        setResolvedParticipantFor(requestedConversationId);
        setNotFound(false);
      } else {
        if (
          activeConversationRef.current === requestedConversationId &&
          fetchSequenceRef.current === requestSequence
        ) {
          setResolvedParticipantFor(requestedConversationId);
          setNotFound(true);
        }
      }
    } catch (error: unknown) {
      console.error('Error fetching messages:', error);
      // Malformed id in the URL (not a uuid) errors before the
      // participant check runs — treat it as not-found, not a chat.
      if (
        activeConversationRef.current === requestedConversationId &&
        fetchSequenceRef.current === requestSequence
      ) {
        setLoadedConversationId(requestedConversationId);
        setResolvedParticipantFor(requestedConversationId);
        if (getErrorCode(error) === '22P02') setNotFound(true);
      }
    } finally {
      if (
        activeConversationRef.current === requestedConversationId &&
        fetchSequenceRef.current === requestSequence
      ) setLoading(false);
    }
  }, [conversationId, user]);

  useEffect(() => {
    fetchSequenceRef.current += 1;
    setMessages([]);
    setParticipant(null);
    setViewerMembership(null);
    setNotFound(false);
    setLoadedConversationId(null);
    setResolvedParticipantFor(null);
    setHasMore(false);
    setLoadingOlder(false);
    setLoading(!!conversationId);
    if (!conversationId || !user) {
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
          if (activeConversationRef.current !== conversationId) return;
          setMessages((previous) => mergeDirectMessageRealtime(previous, incoming));
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED' && activeConversationRef.current === conversationId) {
          // Close the fetch/subscription race and catch anything the socket
          // could not replay while reconnecting.
          void fetchMessages();
        }
      });
    channelRef.current = channel;

    return () => {
      if (channelRef.current === channel) channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [conversationId, fetchMessages, user]);

  const recoverAcknowledgedMessage = useCallback(async (clientId: string): Promise<boolean> => {
    if (!conversationId || !user) return false;
    const { data, error } = await supabase
      .from('direct_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('sender_id', user.id)
      .eq('client_id', clientId)
      .maybeSingle();
    if (error || !data || activeConversationRef.current !== conversationId) return false;
    setMessages((previous) =>
      reconcileDirectMessageAck(previous, data as DirectMessage, clientId),
    );
    return true;
  }, [conversationId, user]);

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
    if (!conversationId || !trimmed) return false;
    if (!user) {
      toast.error('Not authenticated');
      return false;
    }

    const clientId = crypto.randomUUID();
    const optimistic: DirectMessage = {
      id: `temp-${clientId}`,
      conversation_id: conversationId,
      sender_id: user.id,
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
            sender_id: user.id,
            content: trimmed,
            client_id: clientId,
          })
          .select('*')
          .single();
        if (error) throw error;
        if (activeConversationRef.current !== conversationId) return;
        setMessages((previous) =>
          reconcileDirectMessageAck(previous, data as DirectMessage, clientId),
        );
      } catch (error) {
        // The request can lose its response after Postgres committed the row.
        // Resolve by the idempotency key before presenting a false failure.
        if (await recoverAcknowledgedMessage(clientId)) return;
        console.error('Error sending message:', error);
        // Mark the optimistic row failed so the UI can offer a retry.
        if (activeConversationRef.current === conversationId) {
          setMessages(prev =>
            prev.map(m => (m._clientId === clientId ? { ...m, _status: 'failed' as const } : m)),
          );
        }
        toast.error('Failed to send message');
      }
    })();

    return true;
  }, [conversationId, recoverAcknowledgedMessage, user]);

  // Retry a failed send by re-firing the network insert for an existing
  // optimistic row. Same dedupe rules apply — realtime swap finishes
  // the job once the server confirms.
  const retryMessage = useCallback(async (clientId: string): Promise<void> => {
    if (!conversationId) return;
    const target = messages.find((m) => m._clientId === clientId && m._status === 'failed');
    if (!target) return;
    if (!user) return;
    // Flip back to 'sending' for the spinner / pulse.
    setMessages(prev => prev.map(m => (m._clientId === clientId ? { ...m, _status: 'sending' as const } : m)));
    try {
      const { data, error } = await supabase
        .from('direct_messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          content: target.content,
          client_id: clientId,
        })
        .select('*')
        .single();
      if (error) throw error;
      if (activeConversationRef.current !== conversationId) return;
      setMessages((previous) =>
        reconcileDirectMessageAck(previous, data as DirectMessage, clientId),
      );
    } catch (error) {
      // Retrying the same client id may hit the unique constraint when the
      // original request committed but its response was lost. In that case,
      // recover the existing row and treat it as delivered.
      if (await recoverAcknowledgedMessage(clientId)) return;
      console.error('Error retrying message:', error);
      if (activeConversationRef.current === conversationId) {
        setMessages(prev => prev.map(m => (m._clientId === clientId ? { ...m, _status: 'failed' as const } : m)));
      }
      toast.error('Failed to send message');
    }
  }, [conversationId, messages, recoverAcknowledgedMessage, user]);

  // Pull the previous page of (older) messages and prepend them. Keyed on the
  // oldest currently-loaded real message's timestamp; dedupes by id defensively.
  const loadOlder = useCallback(async () => {
    if (!conversationId) return;
    const requestedConversationId = conversationId;
    const oldest = messages.find((m) => !m._clientId) ?? messages[0];
    if (!oldest) return;
    setLoadingOlder(true);
    try {
      const { data, error } = await supabase
        .from('direct_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .lt('created_at', oldest.created_at)
        .order('created_at', { ascending: false })
        .limit(DM_PAGE_SIZE);
      if (error) throw error;
      if (activeConversationRef.current !== requestedConversationId) return;
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
      if (activeConversationRef.current === requestedConversationId) {
        setLoadingOlder(false);
      }
    }
  }, [conversationId, messages]);

  const visibleMessages = useMemo(
    () => messages.filter((message) => message.conversation_id === conversationId),
    [conversationId, messages],
  );

  return {
    messages: visibleMessages,
    loading: loading || (
      !!conversationId &&
      (loadedConversationId !== conversationId || resolvedParticipantFor !== conversationId)
    ),
    hasMore,
    loadingOlder,
    loadOlder,
    participant: resolvedParticipantFor === conversationId ? participant : null,
    viewerMembership: resolvedParticipantFor === conversationId ? viewerMembership : null,
    currentUserId: user?.id ?? null,
    notFound: resolvedParticipantFor === conversationId && notFound,
    sendMessage,
    retryMessage,
    channelRef,
    refetch: fetchMessages,
  };
}
