import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface OnlineFriend {
  user_id: string;
  online_at: string;
}

export function useFriendsPresence(friendIds: string[]) {
  const [onlineFriends, setOnlineFriends] = useState<Set<string>>(new Set());
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (friendIds.length === 0) return;

    let mounted = true;

    const initPresence = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !mounted) return;

      // Use a global friends presence channel
      const channel = supabase.channel('friends-presence', {
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
          const online = new Set<string>();
          
          Object.values(state).forEach((presences: any[]) => {
            presences.forEach((presence) => {
              if (friendIds.includes(presence.user_id)) {
                online.add(presence.user_id);
              }
            });
          });
          
          setOnlineFriends(online);
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED' && mounted) {
            setIsConnected(true);
            await channel.track({
              user_id: user.id,
              online_at: new Date().toISOString(),
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
  }, [friendIds.join(',')]);

  const isOnline = useCallback((userId: string) => {
    return onlineFriends.has(userId);
  }, [onlineFriends]);

  return {
    onlineFriends,
    onlineCount: onlineFriends.size,
    isOnline,
    isConnected,
  };
}
