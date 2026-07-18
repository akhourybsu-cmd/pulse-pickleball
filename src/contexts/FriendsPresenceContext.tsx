import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * App-wide friends presence.
 *
 * A single subscription to the global `friends-presence` channel, mounted once
 * in PlayerShell. It does two things for as long as the player is in the app:
 *   1. tracks the current user's presence, so they show as "online" to their
 *      friends anywhere in the app (not only while on the Friends tab), and
 *   2. exposes the set of all currently-online user ids via context.
 *
 * `useFriendsPresence` reads this context and intersects it with a given
 * friend-id list. Keeping ONE channel avoids duplicate-subscription conflicts
 * and makes the green presence dots actually meaningful.
 */

interface FriendsPresenceValue {
  onlineUserIds: Set<string>;
  isConnected: boolean;
}

const FriendsPresenceContext = createContext<FriendsPresenceValue>({
  onlineUserIds: new Set(),
  isConnected: false,
});

export function FriendsPresenceProvider({ children }: { children: ReactNode }) {
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [isConnected, setIsConnected] = useState(false);
  // Guard against overlapping setup/teardown on fast auth changes.
  const activeRef = useRef(true);

  useEffect(() => {
    activeRef.current = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user || !activeRef.current) return;

      channel = supabase.channel('friends-presence', {
        config: { presence: { key: user.id } },
      });

      channel
        .on('presence', { event: 'sync' }, () => {
          if (!activeRef.current || !channel) return;
          const state = channel.presenceState();
          const online = new Set<string>();
          Object.values(state).forEach((presences) => {
            (presences as Array<{ user_id?: string }>).forEach((p) => {
              if (p.user_id) online.add(p.user_id);
            });
          });
          setOnlineUserIds(online);
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED' && activeRef.current && channel) {
            setIsConnected(true);
            await channel.track({ user_id: user.id, online_at: new Date().toISOString() });
          }
        });
    };

    init();

    return () => {
      activeRef.current = false;
      setIsConnected(false);
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  return (
    <FriendsPresenceContext.Provider value={{ onlineUserIds, isConnected }}>
      {children}
    </FriendsPresenceContext.Provider>
  );
}

export function useFriendsPresenceContext(): FriendsPresenceValue {
  return useContext(FriendsPresenceContext);
}
