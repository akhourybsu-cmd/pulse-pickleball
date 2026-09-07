import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface TypingUser {
  user_id: string;
  display_name: string;
  timestamp: number;
}

const TYPING_HEARTBEAT_MS = 1_500;
const TYPING_IDLE_MS = 3_000;
const TYPING_STALE_MS = 5_000;

export function useTypingIndicator(groupId: string | undefined) {
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const currentUserIdRef = useRef<string | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);
  const lastTypingBroadcastAtRef = useRef(0);

  // Heartbeats arrive while someone continues typing. Keep a slightly wider
  // receiver window than the sender's idle timer so latency cannot make the
  // indicator flicker between keystrokes.
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setTypingUsers(prev => prev.filter(u => now - u.timestamp < TYPING_STALE_MS));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setTypingUsers([]);
    currentUserIdRef.current = null;
    channelRef.current = null;
    isTypingRef.current = false;
    lastTypingBroadcastAtRef.current = 0;
    if (!groupId) return;

    let disposed = false;
    let activeChannel: RealtimeChannel | null = null;

    const initTyping = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || disposed) return;

      currentUserIdRef.current = user.id;

      const channel = supabase.channel(`group-typing-${groupId}`);
      activeChannel = channel;

      channel
        .on('broadcast', { event: 'typing' }, ({ payload }) => {
          if (disposed) return;
          if (payload.user_id === user.id) return; // Ignore own typing

          setTypingUsers(prev => {
            const existing = prev.findIndex(u => u.user_id === payload.user_id);
            const newUser: TypingUser = {
              user_id: payload.user_id,
              display_name: payload.display_name,
              timestamp: Date.now(),
            };

            if (existing >= 0) {
              const updated = [...prev];
              updated[existing] = newUser;
              return updated;
            }
            return [...prev, newUser];
          });
        })
        .on('broadcast', { event: 'stop_typing' }, ({ payload }) => {
          if (disposed) return;
          setTypingUsers(prev => prev.filter(u => u.user_id !== payload.user_id));
        })
        .subscribe();

      channelRef.current = channel;
    };

    void initTyping();

    return () => {
      disposed = true;
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }

      const channel = activeChannel;
      const userId = currentUserIdRef.current;
      const shouldStop = isTypingRef.current && !!channel && !!userId;

      channelRef.current = null;
      currentUserIdRef.current = null;
      isTypingRef.current = false;
      lastTypingBroadcastAtRef.current = 0;

      if (channel) {
        if (shouldStop) {
          // Send the terminal state before removing the channel so navigating
          // away never leaves the other participant looking "active".
          void channel.send({
            type: 'broadcast',
            event: 'stop_typing',
            payload: { user_id: userId },
          }).finally(() => {
            void supabase.removeChannel(channel);
          });
        } else {
          void supabase.removeChannel(channel);
        }
      }
    };
  }, [groupId]);

  const stopTyping = useCallback(async () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    const channel = channelRef.current;
    const userId = currentUserIdRef.current;
    const wasTyping = isTypingRef.current;
    isTypingRef.current = false;
    lastTypingBroadcastAtRef.current = 0;

    if (wasTyping && channel && userId) {
      await channel.send({
        type: 'broadcast',
        event: 'stop_typing',
        payload: { user_id: userId },
      });
    }
  }, []);

  const startTyping = useCallback(async (displayName: string) => {
    const channel = channelRef.current;
    const userId = currentUserIdRef.current;
    if (!channel || !userId) return;

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    // Reset the idle timer immediately, even if a heartbeat is still in flight.
    typingTimeoutRef.current = setTimeout(() => {
      void stopTyping();
    }, TYPING_IDLE_MS);

    const now = Date.now();
    const shouldBroadcast =
      !isTypingRef.current ||
      now - lastTypingBroadcastAtRef.current >= TYPING_HEARTBEAT_MS;

    isTypingRef.current = true;
    if (shouldBroadcast) {
      lastTypingBroadcastAtRef.current = now;
      await channel.send({
        type: 'broadcast',
        event: 'typing',
        payload: {
          user_id: userId,
          display_name: displayName.trim() || 'Someone',
        },
      });
    }
  }, [stopTyping]);

  return {
    typingUsers,
    startTyping,
    stopTyping,
  };
}
