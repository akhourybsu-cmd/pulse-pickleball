import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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
  profile?: {
    id: string;
    display_name: string | null;
    full_name: string;
    avatar_url: string | null;
  };
}

async function fetchGroupMessages(groupId: string): Promise<GroupMessage[]> {
  const { data: messagesData, error } = await supabase
    .from('group_messages')
    .select('*')
    .eq('group_id', groupId)
    .order('created_at', { ascending: true })
    .limit(100);

  if (error) throw error;

  const userIds = [...new Set((messagesData || []).map(m => m.user_id))];
  const { data: profilesData } = userIds.length
    ? await supabase
        .from('profiles')
        .select('id, display_name, full_name, avatar_url')
        .in('id', userIds)
    : { data: [] as any[] };

  const profilesMap = new Map((profilesData || []).map(p => [p.id, p]));

  return (messagesData || []).map(m => ({
    ...m,
    profile: profilesMap.get(m.user_id),
    _status: 'sent' as const,
  })) as GroupMessage[];
}

export function useGroupChat(groupId: string | undefined) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const queryKey = ['group-messages', groupId];

  const { data: messages = [], isLoading: loading, refetch } = useQuery({
    queryKey,
    queryFn: () => fetchGroupMessages(groupId!),
    // Realtime is the source of truth — we patch the cache directly.
    staleTime: Infinity,
    gcTime: 10 * 60 * 1000,
    enabled: !!groupId,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (input: { content: string; imageUrl?: string; clientId: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('group_messages')
        .insert({
          group_id: groupId,
          user_id: user.id,
          content: input.content.trim(),
          ...(input.imageUrl ? { image_url: input.imageUrl } : {}),
        } as any)
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
            ? { ...(row as any), profile: author, _status: 'sent' as const }
            : m,
        );
      });
    },
    onError: (error: any, { clientId }) => {
      queryClient.setQueryData<GroupMessage[]>(queryKey, (prev = []) =>
        prev.map((m) => (m._clientId === clientId ? { ...m, _status: 'failed' as const } : m)),
      );
      console.error('Error sending message:', error);
      toast({
        title: 'Message failed',
        description: error.message || 'Tap to retry',
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
    onError: (error: any, _id, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(queryKey, ctx.prev);
      toast({ title: 'Error', description: error.message || 'Failed to delete', variant: 'destructive' });
    },
  });

  const editMessageMutation = useMutation({
    mutationFn: async ({ messageId, content }: { messageId: string; content: string }) => {
      const { error } = await supabase
        .from('group_messages')
        .update({
          content: content.trim(),
          edited_at: new Date().toISOString(),
        } as any)
        .eq('id', messageId);
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
    onError: (error: any, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(queryKey, ctx.prev);
      toast({ title: 'Error', description: error.message || 'Failed to update message', variant: 'destructive' });
    },
  });

  const togglePinMessage = async (messageId: string, pinned: boolean) => {
    // Optimistic: flip pin state on the target, clear other pins.
    const prev = queryClient.getQueryData<GroupMessage[]>(queryKey);
    queryClient.setQueryData<GroupMessage[]>(queryKey, (p = []) =>
      p.map((m) => {
        if (m.id === messageId) return { ...m, is_pinned: pinned };
        if (pinned && m.is_pinned) return { ...m, is_pinned: false };
        return m;
      }),
    );
    try {
      const { error } = await supabase.rpc('set_group_message_pin', {
        p_message_id: messageId,
        p_pinned: pinned,
      });
      if (error) throw error;
      toast({ title: pinned ? 'Pinned' : 'Unpinned' });
    } catch (error: any) {
      if (prev) queryClient.setQueryData(queryKey, prev);
      toast({ title: 'Error', description: error.message || 'Failed to update pin', variant: 'destructive' });
    }
  };

  return {
    messages,
    loading,
    sending: sendMessageMutation.isPending,
    sendMessage: (content: string, imageUrl?: string, clientId?: string) =>
      sendMessageMutation.mutateAsync({
        content,
        imageUrl,
        clientId: clientId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      }),
    deleteMessage: deleteMessageMutation.mutateAsync,
    editMessage: (messageId: string, content: string) =>
      editMessageMutation.mutateAsync({ messageId, content }),
    togglePinMessage,
    refetch,
  };
}
