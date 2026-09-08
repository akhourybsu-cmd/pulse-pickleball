import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthState } from "@/hooks/useAuthState";

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
  const { user } = useAuthState();
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [isConnected, setIsConnected] = useState(false);
  const userId = user?.id;

  useEffect(() => {
    let active = true;
    let connected = false;
    setIsConnected(false);
    setOnlineUserIds(new Set());
    if (!userId) return;
    const channel = supabase.channel("friends-presence", {
      config: { presence: { key: userId } },
    });
    // Serialize visibility changes so a slow track cannot overtake untrack.
    let presenceWork = Promise.resolve();
    const updateVisibility = () => {
      presenceWork = presenceWork
        .then(async () => {
          if (!active || !connected) return;
          setIsConnected(navigator.onLine);
          if (document.visibilityState === "visible" && navigator.onLine) {
            await channel.track({
              user_id: userId,
              online_at: new Date().toISOString(),
            });
          } else {
            await channel.untrack();
          }
        })
        .catch(() => {
          /* Re-subscription reconciles transient socket failures. */
        });
    };
    const offline = () => {
      setIsConnected(false);
      setOnlineUserIds(new Set());
      updateVisibility();
    };
    channel
      .on("presence", { event: "sync" }, () => {
        if (!active || !connected || !navigator.onLine) return;
        const state = channel.presenceState();
        const online = new Set<string>();
        Object.values(state).forEach((presences) => {
          (presences as Array<{ user_id?: string }>).forEach((p) => {
            if (p.user_id) online.add(p.user_id);
          });
        });
        setOnlineUserIds(online);
      })
      .subscribe((status) => {
        if (!active) return;
        connected = status === "SUBSCRIBED";
        setIsConnected(connected && navigator.onLine);
        if (connected) updateVisibility();
        else setOnlineUserIds(new Set());
      });
    document.addEventListener("visibilitychange", updateVisibility);
    window.addEventListener("online", updateVisibility);
    window.addEventListener("offline", offline);

    return () => {
      active = false;
      document.removeEventListener("visibilitychange", updateVisibility);
      window.removeEventListener("online", updateVisibility);
      window.removeEventListener("offline", offline);
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  return (
    <FriendsPresenceContext.Provider value={{ onlineUserIds, isConnected }}>
      {children}
    </FriendsPresenceContext.Provider>
  );
}

export function useFriendsPresenceContext(): FriendsPresenceValue {
  return useContext(FriendsPresenceContext);
}
