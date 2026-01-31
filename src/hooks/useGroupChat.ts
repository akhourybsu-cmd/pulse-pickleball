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
  }));
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
    mutationFn: async (content: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('group_messages')
        .insert({
          group_id: groupId,
          user_id: user.id,
          content: content.trim(),
        })
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

  return {
    messages,
    loading,
    sending: sendMessageMutation.isPending,
    sendMessage: sendMessageMutation.mutateAsync,
    deleteMessage: deleteMessageMutation.mutateAsync,
    refetch,
  };
}
