import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/lib/getErrorMessage';
import { toggleOwnReaction, type ReactionSummary } from '@/lib/chat/reactions';

export interface GroupMessage {
  id: string;
  group_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  is_pinned?: boolean;
  pinned_by?: string | null;
  pinned_at?: string | null;
  edited_at?: string | null;
  image_url?: string | null;
  /** Client-only fields for optimistic UI. Never persisted. */
  _status?: 'sending' | 'sent' | 'failed';
  _clientId?: string;
  reactions?: GroupMessageReaction[];
  profile?: {
    id: string;
    display_name: string | null;
    full_name: string;
    avatar_url: string | null;
  };
}

export type GroupMessageReaction = ReactionSummary;

const MESSAGE_PAGE_SIZE = 100;

async function fetchGroupMessagesPage(
  groupId: string,
  before?: string,
): Promise<GroupMessage[]> {
  // Fetch the NEWEST page (descending + limit), then reverse to chronological
  // for display. Ordering ascending + limit(100) returned the OLDEST 100
  // messages instead — in an active group you'd be stuck looking at ancient
  // history, never the recent chat.
  let query = supabase
    .from('group_messages')
    .select('*')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false });

  if (before) query = query.lt('created_at', before);

  const { data: messagesData, error } = await query.limit(MESSAGE_PAGE_SIZE);

  if (error) throw error;

  const ordered = (messagesData || []).slice().reverse();

  const userIds = [...new Set(ordered.map(m => m.user_id))];
  const messageIds = ordered.map((m) => m.id);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profilesData }, reactionsResult] = await Promise.all([
    userIds.length
      ? supabase
          .from('profiles_public')
          .select('id, display_name, full_name, avatar_url')
          .in('id', userIds)
      : Promise.resolve({ data: [] as NonNullable<GroupMessage['profile']>[] }),
    messageIds.length
      ? supabase
          .from('group_message_reactions')
          .select('message_id, user_id, emoji')
          .in('message_id', messageIds)
      : Promise.resolve({ data: [] }),
  ]);

  const profilesMap = new Map((profilesData || []).map(p => [p.id, p]));
  const reactionsByMessage = new Map<string, Map<string, GroupMessageReaction>>();

  for (const row of (reactionsResult.data ?? []) as Array<{
    message_id: string;
    user_id: string;
    emoji: string;
  }>) {
    const byEmoji = reactionsByMessage.get(row.message_id) ?? new Map<string, GroupMessageReaction>();
    const reaction = byEmoji.get(row.emoji) ?? {
      emoji: row.emoji,
      count: 0,
      hasReacted: false,
    };
    reaction.count += 1;
    if (row.user_id === user?.id) reaction.hasReacted = true;
    byEmoji.set(row.emoji, reaction);
    reactionsByMessage.set(row.message_id, byEmoji);
  }

  return ordered.map(m => ({
    ...m,
    profile: profilesMap.get(m.user_id),
    reactions: [...(reactionsByMessage.get(m.id)?.values() ?? [])],
    _status: 'sent' as const,
  })) as GroupMessage[];
}

export function useGroupChat(groupId: string | undefined) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ['group-messages', groupId] as const, [groupId]);
  const [hasOlder, setHasOlder] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const initializedForGroup = useRef<string | undefined>();

  const { data: messages = [], isLoading: loading, refetch } = useQuery({
    queryKey,
    queryFn: () => fetchGroupMessagesPage(groupId!),
    // Realtime keeps an open chat fresh. Refetch on mount also closes the gap
    // for messages sent while this screen was not subscribed.
    staleTime: 15_000,
    gcTime: 10 * 60 * 1000,
    refetchOnMount: 'always',
    enabled: !!groupId,
  });

  useEffect(() => {
    initializedForGroup.current = undefined;
    setHasOlder(true);
    setLoadingOlder(false);
  }, [groupId]);

  useEffect(() => {
    if (initializedForGroup.current === groupId || loading) return;
    initializedForGroup.current = groupId;
    setHasOlder(messages.length === MESSAGE_PAGE_SIZE);
  }, [groupId, loading, messages.length]);

  const loadOlder = useCallback(async () => {
    if (!groupId || loadingOlder || !hasOlder) return;
    const cached = queryClient.getQueryData<GroupMessage[]>(queryKey) ?? [];
    const oldest = cached.find((message) => !message.id.startsWith('temp-'));
    if (!oldest) {
      setHasOlder(false);
      return;
    }

    setLoadingOlder(true);
    try {
      const page = await fetchGroupMessagesPage(groupId, oldest.created_at);
      queryClient.setQueryData<GroupMessage[]>(queryKey, (current = []) => {
        const known = new Set(current.map((message) => message.id));
        return [...page.filter((message) => !known.has(message.id)), ...current];
      });
      setHasOlder(page.length === MESSAGE_PAGE_SIZE);
    } catch (error: unknown) {
      toast({
        title: 'Could not load earlier messages',
        description: getErrorMessage(error, 'Please try again'),
        variant: 'destructive',
      });
    } finally {
      setLoadingOlder(false);
    }
  }, [groupId, hasOlder, loadingOlder, queryClient, queryKey, toast]);

  const sendMessageMutation = useMutation({
    mutationFn: async (input: { content: string; imageUrl?: string; clientId: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('group_messages')
        .insert({
          group_id: groupId!,
          user_id: user.id,
          content: input.content.trim(),
          ...(input.imageUrl ? { image_url: input.imageUrl } : {}),
        })
        .select()
        .single();

      if (error) throw error;
      return { row: data, clientId: input.clientId, userId: user.id };
    },
    onMutate: async ({ content, imageUrl, clientId }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      // Pull author profile from cache if we have it
      const cachedAuthor = (queryClient.getQueryData<GroupMessage[]>(queryKey) || [])
        .find((m) => m.user_id === user.id)?.profile;
      const now = new Date().toISOString();
      const optimistic: GroupMessage = {
        id: `temp-${clientId}`,
        _clientId: clientId,
        _status: 'sending',
        group_id: groupId!,
        user_id: user.id,
        content: content.trim(),
        image_url: imageUrl ?? null,
        created_at: now,
        updated_at: now,
        profile: cachedAuthor,
      };
      queryClient.setQueryData<GroupMessage[]>(queryKey, (prev = []) => [...prev, optimistic]);
    },
    onSuccess: ({ row, clientId, userId }) => {
      queryClient.setQueryData<GroupMessage[]>(queryKey, (prev = []) => {
        const author = prev.find((m) => m.user_id === userId)?.profile;
        // If realtime already replaced the temp row, do nothing
        if (prev.some((m) => m.id === row.id)) {
          return prev.filter((m) => m._clientId !== clientId || m.id === row.id);
        }
        return prev.map((m) =>
          m._clientId === clientId
            ? {
                ...row,
                created_at: row.created_at ?? new Date().toISOString(),
                updated_at: row.updated_at ?? new Date().toISOString(),
                profile: author,
                reactions: [],
                _status: 'sent' as const,
              }
            : m,
        );
      });
    },
    onError: (error: unknown, { clientId }) => {
      queryClient.setQueryData<GroupMessage[]>(queryKey, (prev = []) =>
        prev.map((m) => (m._clientId === clientId ? { ...m, _status: 'failed' as const } : m)),
      );
      console.error('Error sending message:', error);
      toast({
        title: 'Message failed',
        description: getErrorMessage(error, 'Tap to retry'),
        variant: 'destructive',
      });
    },
  });

  const deleteMessageMutation = useMutation({
    mutationFn: async (messageId: string) => {
      const { error } = await supabase
        .from('group_messages')
        .delete()
        .eq('id', messageId);
      if (error) throw error;
    },
    onMutate: async (messageId) => {
      const prev = queryClient.getQueryData<GroupMessage[]>(queryKey);
      queryClient.setQueryData<GroupMessage[]>(queryKey, (p = []) =>
        p.filter((m) => m.id !== messageId),
      );
      return { prev };
    },
    onError: (error: unknown, _id, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(queryKey, ctx.prev);
      toast({ title: 'Error', description: getErrorMessage(error, 'Failed to delete'), variant: 'destructive' });
    },
  });

  const editMessageMutation = useMutation({
    mutationFn: async ({ messageId, content }: { messageId: string; content: string }) => {
      const { error } = await supabase.rpc('edit_group_message', {
        p_message_id: messageId,
        p_content: content.trim(),
      });
      if (error) throw error;
    },
    onMutate: async ({ messageId, content }) => {
      const prev = queryClient.getQueryData<GroupMessage[]>(queryKey);
      queryClient.setQueryData<GroupMessage[]>(queryKey, (p = []) =>
        p.map((m) =>
          m.id === messageId
            ? { ...m, content: content.trim(), edited_at: new Date().toISOString() }
            : m,
        ),
      );
      return { prev };
    },
    onError: (error: unknown, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(queryKey, ctx.prev);
      toast({ title: 'Error', description: getErrorMessage(error, 'Failed to update message'), variant: 'destructive' });
    },
  });

  // Converted from a manual async to a proper mutation so each in-flight
  // pin toggle owns its own `prev` snapshot via onMutate/onError context.
  // Pre-conversion, two rapid clicks shared a closure pattern that could
  // rollback to a stale snapshot if the calls interleaved with failures.
  const togglePinMessageMutation = useMutation({
    mutationFn: async ({ messageId, pinned }: { messageId: string; pinned: boolean }) => {
      const { error } = await supabase.rpc('set_group_message_pin', {
        p_message_id: messageId,
        p_pinned: pinned,
      });
      if (error) throw error;
    },
    onMutate: async ({ messageId, pinned }) => {
      const prev = queryClient.getQueryData<GroupMessage[]>(queryKey);
      queryClient.setQueryData<GroupMessage[]>(queryKey, (p = []) =>
        p.map((m) => {
          if (m.id === messageId) return { ...m, is_pinned: pinned };
          if (pinned && m.is_pinned) return { ...m, is_pinned: false };
          return m;
        }),
      );
      return { prev };
    },
    onSuccess: (_d, { pinned }) => {
      toast({ title: pinned ? 'Pinned' : 'Unpinned' });
    },
    onError: (error: unknown, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(queryKey, ctx.prev);
      toast({ title: 'Error', description: getErrorMessage(error, 'Failed to update pin'), variant: 'destructive' });
    },
  });

  const togglePinMessage = (messageId: string, pinned: boolean) =>
    togglePinMessageMutation.mutate({ messageId, pinned });

  const toggleReactionMutation = useMutation({
    mutationFn: async ({ messageId, emoji }: { messageId: string; emoji: string }) => {
      const { error } = await supabase.rpc('toggle_group_message_reaction', {
        p_message_id: messageId,
        p_emoji: emoji,
      });
      if (error) throw error;
    },
    onMutate: async ({ messageId, emoji }) => {
      const previous = queryClient.getQueryData<GroupMessage[]>(queryKey);
      queryClient.setQueryData<GroupMessage[]>(queryKey, (current = []) =>
        current.map((message) => {
          if (message.id !== messageId) return message;
          return { ...message, reactions: toggleOwnReaction(message.reactions ?? [], emoji) };
        }),
      );
      return { previous };
    },
    onError: (error: unknown, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
      toast({
        title: 'Reaction failed',
        description: getErrorMessage(error, 'Please try again'),
        variant: 'destructive',
      });
    },
  });

  // Retry a failed group message send. Mirrors the DM retry pattern in
  // useDirectMessages — flip the existing temp row's _status back to
  // 'sending' so the bubble re-pulses, then re-fire the insert. The
  // realtime INSERT handler in useGroupRealtime swaps the temp row for
  // the server row by clientId match on success; on error we flip the
  // _status back to 'failed' so the retry button reappears.
  const retryMessage = async (clientId: string): Promise<void> => {
    const cached = queryClient.getQueryData<GroupMessage[]>(queryKey) || [];
    const target = cached.find((m) => m._clientId === clientId && m._status === 'failed');
    if (!target) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    queryClient.setQueryData<GroupMessage[]>(queryKey, (prev = []) =>
      prev.map((m) => (m._clientId === clientId ? { ...m, _status: 'sending' as const } : m)),
    );

    try {
      const { data: row, error } = await supabase
        .from('group_messages')
        .insert({
          group_id: groupId!,
          user_id: user.id,
          content: target.content.trim(),
          ...(target.image_url ? { image_url: target.image_url } : {}),
        })
        .select()
        .single();
      if (error) throw error;

      queryClient.setQueryData<GroupMessage[]>(queryKey, (previous = []) => {
        if (previous.some((message) => message.id === row.id)) {
          return previous.filter((message) => message._clientId !== clientId || message.id === row.id);
        }
        return previous.map((message) =>
          message._clientId === clientId
            ? {
                ...row,
                created_at: row.created_at ?? new Date().toISOString(),
                updated_at: row.updated_at ?? new Date().toISOString(),
                profile: message.profile,
                reactions: [],
                _status: 'sent' as const,
              }
            : message,
        );
      });
    } catch (error: unknown) {
      queryClient.setQueryData<GroupMessage[]>(queryKey, (prev = []) =>
        prev.map((m) => (m._clientId === clientId ? { ...m, _status: 'failed' as const } : m)),
      );
      console.error('Error retrying message:', error);
      toast({ title: 'Message failed', description: getErrorMessage(error, 'Tap to retry'), variant: 'destructive' });
    }
  };

  return {
    messages,
    loading,
    hasOlder,
    loadingOlder,
    loadOlder,
    sending: sendMessageMutation.isPending,
    sendMessage: (content: string, imageUrl?: string, clientId?: string) =>
      sendMessageMutation.mutateAsync({
        content,
        imageUrl,
        clientId: clientId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      }),
    retryMessage,
    deleteMessage: deleteMessageMutation.mutateAsync,
    editMessage: (messageId: string, content: string) =>
      editMessageMutation.mutateAsync({ messageId, content }),
    togglePinMessage,
    toggleReaction: (messageId: string, emoji: string) =>
      toggleReactionMutation.mutate({ messageId, emoji }),
    refetch,
  };
}
