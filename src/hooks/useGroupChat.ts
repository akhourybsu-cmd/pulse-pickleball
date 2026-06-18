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
  /** Phase 2 polish — see migration 20260617210000_group_chat_polish. */
  is_pinned?: boolean;
  pinned_by?: string | null;
  pinned_at?: string | null;
  edited_at?: string | null;
  image_url?: string | null;
  profile?: {
    id: string;
    display_name: string | null;
    full_name: string;
    avatar_url: string | null;
  };
}

async function fetchGroupMessages(groupId: string): Promise<GroupMessage[]> {
  // Fetch last 100 messages
  const { data: messagesData, error } = await supabase
    .from('group_messages')
    .select('*')
    .eq('group_id', groupId)
    .order('created_at', { ascending: true })
    .limit(100);

  if (error) throw error;

  // Fetch profiles for message authors
  const userIds = [...new Set((messagesData || []).map(m => m.user_id))];
  const { data: profilesData } = await supabase
    .from('profiles')
    .select('id, display_name, full_name, avatar_url')
    .in('id', userIds);

  const profilesMap = new Map((profilesData || []).map(p => [p.id, p]));

  return (messagesData || []).map(m => ({
    ...m,
    profile: profilesMap.get(m.user_id),
  })) as GroupMessage[];
}

export function useGroupChat(groupId: string | undefined) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: messages = [], isLoading: loading, refetch } = useQuery({
    queryKey: ['group-messages', groupId],
    queryFn: () => fetchGroupMessages(groupId!),
    staleTime: 10 * 1000, // 10 seconds - shorter for chat
    gcTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!groupId,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (input: { content: string; imageUrl?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('group_messages')
        .insert({
          group_id: groupId,
          user_id: user.id,
          content: input.content.trim(),
          // image_url column is added by 20260617210000_group_chat_polish;
          // older DB schemas silently drop it (PostgREST returns the
          // inserted row without it).
          ...(input.imageUrl ? { image_url: input.imageUrl } : {}),
        } as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-messages', groupId] });
    },
    onError: (error: any) => {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to send message',
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-messages', groupId] });
    },
    onError: (error: any) => {
      console.error('Error deleting message:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete message',
        variant: 'destructive',
      });
    },
  });

  /**
   * Edit your own message content. Sets edited_at = now() so the UI can
   * render a small "(edited)" hint. Existing RLS lets the author update
   * their row, which is exactly what we want.
   */
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-messages', groupId] });
    },
    onError: (error: any) => {
      console.error('Error editing message:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update message',
        variant: 'destructive',
      });
    },
  });

  /**
   * Pin / unpin a chat message. Goes through the set_group_message_pin
   * SECURITY DEFINER RPC so the role check (owner/moderator/author)
   * happens server-side, and so that pinning one message implicitly
   * unpins any other pinned message in the same group.
   */
  const togglePinMessage = async (messageId: string, pinned: boolean) => {
    try {
      const { error } = await supabase.rpc('set_group_message_pin', {
        p_message_id: messageId,
        p_pinned: pinned,
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['group-messages', groupId] });
      toast({ title: pinned ? 'Pinned' : 'Unpinned' });
    } catch (error: any) {
      console.error('Error toggling pin:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update pin',
        variant: 'destructive',
      });
    }
  };

  return {
    messages,
    loading,
    sending: sendMessageMutation.isPending,
    sendMessage: (content: string, imageUrl?: string) =>
      sendMessageMutation.mutateAsync({ content, imageUrl }),
    deleteMessage: deleteMessageMutation.mutateAsync,
    editMessage: editMessageMutation.mutateAsync,
    togglePinMessage,
    refetch,
  };
}
