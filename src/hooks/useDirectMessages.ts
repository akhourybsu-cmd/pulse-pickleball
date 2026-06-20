import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { RealtimeChannel } from '@supabase/supabase-js';

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
}

export function useDirectMessages() {
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalUnread, setTotalUnread] = useState(0);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const fetchConversations = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get all conversation participations for current user
      const { data: participations, error: partError } = await supabase
        .from('conversation_participants')
        .select('conversation_id, last_read_at')
        .eq('user_id', user.id);

      if (partError) throw partError;
      if (!participations || participations.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      const conversationIds = participations.map(p => p.conversation_id);
      const lastReadMap = new Map(participations.map(p => [p.conversation_id, p.last_read_at]));

      // Get conversation details
      const { data: convos, error: convError } = await supabase
        .from('conversations')
        .select('id, updated_at')
        .in('id', conversationIds)
        .order('updated_at', { ascending: false });

      if (convError) throw convError;

      const previews: ConversationPreview[] = [];
      let totalUnreadCount = 0;

      for (const convo of convos || []) {
        // Get the other participant
        const { data: otherParticipants } = await supabase
          .from('conversation_participants')
          .select('user_id')
          .eq('conversation_id', convo.id)
          .neq('user_id', user.id);

        if (!otherParticipants || otherParticipants.length === 0) continue;

        const otherUserId = otherParticipants[0].user_id;
        
        // Get profile from public view (profiles table is owner-only)
        const { data: profile } = await supabase
          .from('profiles_public')
          .select('id, display_name, full_name, avatar_url, current_rating')
          .eq('id', otherUserId)
          .maybeSingle();

        // Get last message
        const { data: messages } = await supabase
          .from('direct_messages')
          .select('*')
          .eq('conversation_id', convo.id)
          .order('created_at', { ascending: false })
          .limit(1);

        const lastMessage = messages && messages.length > 0 ? messages[0] : null;

        // Calculate unread count
        const lastRead = lastReadMap.get(convo.id);
        const { count: unreadCount } = await supabase
          .from('direct_messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', convo.id)
          .neq('sender_id', user.id)
          .gt('created_at', lastRead || '1970-01-01');

        totalUnreadCount += unreadCount || 0;

        previews.push({
          id: convo.id,
          updated_at: convo.updated_at,
          participant: {
            id: profile.id,
            user_id: profile.id,
            display_name: profile.display_name,
            full_name: profile.full_name,
            avatar_url: profile.avatar_url,
            current_rating: profile.current_rating
          },
          lastMessage,
          unreadCount: unreadCount || 0
        });
      }

      setConversations(previews);
      setTotalUnread(totalUnreadCount);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();

    // Subscribe to new messages for real-time updates
    const setupSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      channelRef.current = supabase
        .channel('dm-inbox-updates')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'direct_messages'
          },
          () => {
            fetchConversations();
          }
        )
        .subscribe();
    };

    setupSubscription();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [fetchConversations]);

  const startConversation = useCallback(async (otherUserId: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase.rpc('get_or_create_dm_conversation', {
        other_user_id: otherUserId
      });

      if (error) throw error;
      
      await fetchConversations();
      return data as string;
    } catch (error) {
      console.error('Error starting conversation:', error);
      toast.error('Failed to start conversation');
      return null;
    }
  }, [fetchConversations]);

  return {
    conversations,
    loading,
    totalUnread,
    startConversation,
    refetch: fetchConversations
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

      // Fetch messages
      const { data, error } = await supabase
        .from('direct_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);

      // Get other participant info
      const { data: participants } = await supabase
        .from('conversation_participants')
        .select('user_id')
        .eq('conversation_id', conversationId)
        .neq('user_id', user.id);

      if (participants && participants.length > 0) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, display_name, full_name, avatar_url, current_rating')
          .eq('id', participants[0].user_id)
          .single();

        if (profile) {
          setParticipant({
            id: profile.id,
            user_id: profile.id,
            display_name: profile.display_name,
            full_name: profile.full_name,
            avatar_url: profile.avatar_url,
            current_rating: profile.current_rating
          });
        }
      }

      // Mark as read
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

    // Subscribe to new messages
    channelRef.current = supabase
      .channel(`dm-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          setMessages(prev => [...prev, payload.new as DirectMessage]);
          
          // Mark as read immediately
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
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
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
          content: content.trim()
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
    refetch: fetchMessages
  };
}
