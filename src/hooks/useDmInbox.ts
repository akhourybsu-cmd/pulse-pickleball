import { useCallback, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthState } from '@/hooks/useAuthState';
import { getErrorMessage } from '@/lib/getErrorMessage';
import { interpretDmError } from '@/lib/dmErrors';
import { toast } from 'sonner';
import type { ConversationPreview, ConversationParticipant, DirectMessage } from './useDirectMessages';

interface InboxRow {
  id: string; updated_at: string; participant: ConversationParticipant;
  last_message: DirectMessage | null; unread_count: number; is_muted: boolean;
}

export function useDmInboxState(enabled: boolean) {
  const { user } = useAuthState();
  const userId = user?.id ?? null;
  const client = useQueryClient();
  const key = useMemo(() => ['dm-inbox', userId], [userId]);
  const query = useQuery({
    queryKey: key, enabled: enabled && !!userId, staleTime: 30_000,
    refetchOnWindowFocus: false,
    queryFn: async ({ signal }): Promise<ConversationPreview[]> => {
      const { data, error } = await supabase.rpc('social_dm_inbox' as never).abortSignal(signal);
      if (error) throw error;
      return ((data ?? []) as InboxRow[]).map(row => ({ id: row.id, updated_at: row.updated_at,
        participant: row.participant, lastMessage: row.last_message, unreadCount: row.unread_count,
        isMuted: row.is_muted, leftAt: null }));
    },
  });
  const refresh = useCallback(() => client.invalidateQueries({ queryKey: key }), [client, key]);
  useEffect(() => {
    if (!enabled || !userId) return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => { clearTimeout(timer); timer = setTimeout(() => void refresh(), 180); };
    const visible = () => { if (document.visibilityState === 'visible') schedule(); };
    let connected = false;
    const channel = supabase.channel(`dm-inbox:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'direct_messages' }, schedule)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_participants', filter: `user_id=eq.${userId}` }, schedule)
      .subscribe(status => { if (status === 'SUBSCRIBED') { if (connected) schedule(); connected = true; } });
    window.addEventListener('online', schedule);
    document.addEventListener('visibilitychange', visible);
    return () => { clearTimeout(timer); window.removeEventListener('online', schedule);
      document.removeEventListener('visibilitychange', visible); void supabase.removeChannel(channel); };
  }, [enabled, userId, refresh]);

  const updateMembership = useCallback(async (id: string, change: Record<string, unknown>, update: (rows: ConversationPreview[]) => ConversationPreview[]) => {
    if (!userId) return false;
    // Cancel older snapshots before changing unread/mute state so an in-flight
    // response cannot put the old badge back after this action succeeds.
    try {
      await client.cancelQueries({ queryKey: key });
      const { error } = await supabase.from('conversation_participants').update(change)
        .eq('conversation_id', id).eq('user_id', userId);
      if (error) throw error;
      client.setQueryData<ConversationPreview[]>(key, rows => update(rows ?? []));
      void refresh();
      return true;
    } catch {
      toast.error('Could not update this conversation. Please try again.');
      return false;
    }
  }, [userId, key, client, refresh]);
  const markRead = useCallback((id: string) => updateMembership(id, { last_read_at: new Date().toISOString() },
    rows => rows.map(row => row.id === id ? { ...row, unreadCount: 0 } : row)), [updateMembership]);
  const setMuted = useCallback(async (id: string, muted: boolean) => {
    const saved = await updateMembership(id, { is_muted: muted }, rows => rows.map(row => row.id === id ? { ...row, isMuted: muted } : row));
    if (saved) toast.success(muted ? 'Conversation muted' : 'Conversation unmuted');
    return saved;
  }, [updateMembership]);
  const leaveConversation = useCallback(async (id: string) => {
    const saved = await updateMembership(id, { left_at: new Date().toISOString() }, rows => rows.filter(row => row.id !== id));
    if (saved) toast.success('You left the conversation');
    return saved;
  }, [updateMembership]);
  const startConversation = useCallback(async (otherUserId: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase.rpc('get_or_create_dm_conversation', { other_user_id: otherUserId });
      if (error) throw error;
      void refresh(); return data as string;
    } catch (error) { toast.error(interpretDmError(error)); return null; }
  }, [refresh]);
  const conversations = userId ? query.data ?? [] : [];
  return { conversations, loading: enabled && !!userId && query.isPending,
    refreshing: query.isFetching && !query.isPending,
    error: query.error ? getErrorMessage(query.error, 'Could not refresh your messages.') : null,
    totalUnread: conversations.reduce((sum, row) => sum + row.unreadCount, 0), currentUserId: userId,
    markRead, setMuted, leaveConversation, startConversation, refetch: refresh };
}
