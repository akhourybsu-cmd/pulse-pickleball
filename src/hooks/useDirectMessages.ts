import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { interpretDmError } from '@/lib/dmErrors';

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

export function useDirectMessages() {
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalUnread, setTotalUnread] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const fetchConversations = useCallback(async () => {
    try {
      setError(null);
      const { data: { user } } = await supabase.auth.getUser();
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
        .eq('user_id', user.id);
      if (mineErr) throw mineErr;
      if (!mine || mine.length === 0) {
        setConversations([]);
        setTotalUnread(0);
        setLoading(false);
        return;
      }

      const convoIds = mine.map(m => m.conversation_id);
      const myMeta = new Map(mine.map(m => [m.conversation_id, m]));

      // 2. Conversation rows
      const { data: convos, error: convErr } = await supabase
        .from('conversations')
        .select('id, updated_at')
        .in('id', convoIds)
        .order('updated_at', { ascending: false });
      if (convErr) throw convErr;

      // 3. Other participants in those conversations
      const { data: others, error: othersErr } = await supabase
        .from('conversation_participants')
        .select('conversation_id, user_id')
        .in('conversation_id', convoIds)
        .neq('user_id', user.id);
      if (othersErr) throw othersErr;
      const otherByConvo = new Map<string, string>();
      for (const o of others || []) {
        if (!otherByConvo.has(o.conversation_id)) {
          otherByConvo.set(o.conversation_id, o.user_id);
        }
      }
      const otherUserIds = Array.from(new Set(otherByConvo.values()));

      // 4. Profiles in one shot
      const profileMap = new Map<string, any>();
      if (otherUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles_public')
          .select('id, display_name, full_name, avatar_url, current_rating')
          .in('id', otherUserIds);
        for (const p of profiles || []) profileMap.set(p.id, p);
      }

      // 5. All messages for those conversations (recent first); reduce client-side
      const { data: allMessages, error: msgErr } = await supabase
        .from('direct_messages')
        .select('id, conversation_id, sender_id, content, created_at')
        .in('conversation_id', convoIds)
        .order('created_at', { ascending: false });
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
    } catch (e: any) {
      console.error('Error fetching conversations:', e);
      setError(e?.message || 'Failed to load conversations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();

    const setupSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      channelRef.current = supabase
        .channel('dm-inbox-updates')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'direct_messages' },
          () => { fetchConversations(); }
        )
        .subscribe();
    };
    setupSubscription();

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [fetchConversations]);

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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from('conversation_participants')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id);
    setConversations(prev => prev.map(c =>
      c.id === conversationId ? { ...c, unreadCount: 0 } : c
    ));
    setTotalUnread(prev => {
      const target = conversations.find(c => c.id === conversationId);
      return Math.max(0, prev - (target?.unreadCount || 0));
    });
  }, [conversations]);

  const setMuted = useCallback(async (conversationId: string, muted: boolean) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { error: e } = await supabase
      .from('conversation_participants')
      .update({ is_muted: muted } as any)
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id);
    if (e) { toast.error('Failed to update mute'); return false; }
    setConversations(prev => prev.map(c =>
      c.id === conversationId ? { ...c, isMuted: muted } : c
    ));
    toast.success(muted ? 'Conversation muted' : 'Conversation unmuted');
    return true;
  }, []);

  const leaveConversation = useCallback(async (conversationId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { error: e } = await supabase
      .from('conversation_participants')
      .update({ left_at: new Date().toISOString() } as any)
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id);
    if (e) { toast.error('Failed to leave conversation'); return false; }
    setConversations(prev => prev.filter(c => c.id !== conversationId));
    toast.success('You left the conversation');
    return true;
  }, []);

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

export function useConversation(conversationId: string | null) {
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [participant, setParticipant] = useState<ConversationParticipant | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const fetchMessages = useCallback(async () => {
    if (!conversationId) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('direct_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setMessages(data || []);

      const { data: participants } = await supabase
        .from('conversation_participants')
        .select('user_id')
        .eq('conversation_id', conversationId)
        .neq('user_id', user.id);

      if (participants && participants.length > 0) {
        const otherId = participants[0].user_id;
        const { data: profile } = await supabase
          .from('profiles_public')
          .select('id, display_name, full_name, avatar_url, current_rating')
          .eq('id', otherId)
          .maybeSingle();
        setParticipant({
          id: otherId,
          user_id: otherId,
          display_name: profile?.display_name ?? null,
          full_name: profile?.full_name ?? null,
          avatar_url: profile?.avatar_url ?? null,
          current_rating: profile?.current_rating ?? null,
        });
      }

      await supabase
        .from('conversation_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) return;
    fetchMessages();

    channelRef.current = supabase
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
          setMessages(prev => [...prev, payload.new as DirectMessage]);
          supabase.auth.getUser().then(({ data: { user } }) => {
            if (user) {
              supabase
                .from('conversation_participants')
                .update({ last_read_at: new Date().toISOString() })
                .eq('conversation_id', conversationId)
                .eq('user_id', user.id);
            }
          });
        }
      )
      .subscribe();

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [conversationId, fetchMessages]);

  const sendMessage = useCallback(async (content: string): Promise<boolean> => {
    if (!conversationId || !content.trim()) return false;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('direct_messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          content: content.trim(),
        });
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
      return false;
    }
  }, [conversationId]);

  return {
    messages,
    loading,
    participant,
    sendMessage,
    channelRef,
    refetch: fetchMessages,
  };
}
