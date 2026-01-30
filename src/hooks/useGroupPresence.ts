import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface OnlineUser {
  user_id: string;
  online_at: string;
  display_name?: string;
  avatar_url?: string;
}

export function useGroupPresence(groupId: string | undefined) {
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!groupId) return;

    let mounted = true;

    const initPresence = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !mounted) return;

      // Get user profile for display name
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, full_name, avatar_url')
        .eq('id', user.id)
        .single();

      const channel = supabase.channel(`group-presence-${groupId}`, {
        config: {
          presence: {
            key: user.id,
          },
        },
      });

      channel
        .on('presence', { event: 'sync' }, () => {
          if (!mounted) return;
          const state = channel.presenceState();
          const users: OnlineUser[] = [];
          
          Object.values(state).forEach((presences: any[]) => {
            presences.forEach((presence) => {
              users.push({
                user_id: presence.user_id,
                online_at: presence.online_at,
                display_name: presence.display_name,
                avatar_url: presence.avatar_url,
              });
            });
          });
          
          setOnlineUsers(users);
        })
        .on('presence', { event: 'join' }, ({ newPresences }) => {
          // Handled by sync
        })
        .on('presence', { event: 'leave' }, ({ leftPresences }) => {
          // Handled by sync
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED' && mounted) {
            setIsConnected(true);
            await channel.track({
              user_id: user.id,
              online_at: new Date().toISOString(),
              display_name: profile?.display_name || profile?.full_name || 'User',
              avatar_url: profile?.avatar_url,
            });
          }
        });

      return () => {
        mounted = false;
        setIsConnected(false);
        supabase.removeChannel(channel);
      };
    };

    const cleanup = initPresence();

    return () => {
      mounted = false;
      cleanup?.then(fn => fn?.());
    };
  }, [groupId]);

  const isOnline = useCallback((userId: string) => {
    return onlineUsers.some(u => u.user_id === userId);
  }, [onlineUsers]);

  return {
    onlineUsers,
    onlineCount: onlineUsers.length,
    isOnline,
    isConnected,
  };
}
