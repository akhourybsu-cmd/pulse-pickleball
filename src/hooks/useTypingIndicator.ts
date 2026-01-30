import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface TypingUser {
  user_id: string;
  display_name: string;
  timestamp: number;
}

export function useTypingIndicator(groupId: string | undefined) {
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const currentUserIdRef = useRef<string | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);

  // Clear stale typing states after 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setTypingUsers(prev => prev.filter(u => now - u.timestamp < 3000));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!groupId) return;

    let mounted = true;

    const initTyping = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !mounted) return;

      currentUserIdRef.current = user.id;

      const channel = supabase.channel(`group-typing-${groupId}`);

      channel
        .on('broadcast', { event: 'typing' }, ({ payload }) => {
          if (!mounted) return;
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
          if (!mounted) return;
          setTypingUsers(prev => prev.filter(u => u.user_id !== payload.user_id));
        })
        .subscribe();

      channelRef.current = channel;

      return () => {
        mounted = false;
        supabase.removeChannel(channel);
      };
    };

    const cleanup = initTyping();

    return () => {
      cleanup?.then(fn => fn?.());
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [groupId]);

  const startTyping = useCallback(async (displayName: string) => {
    if (!channelRef.current || !currentUserIdRef.current) return;

    // Clear any existing stop-typing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Only send if not already marked as typing
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      await channelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: {
          user_id: currentUserIdRef.current,
          display_name: displayName,
        },
      });
    }

    // Auto-stop after 3 seconds of no typing
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 3000);
  }, []);

  const stopTyping = useCallback(async () => {
    if (!channelRef.current || !currentUserIdRef.current) return;

    if (isTypingRef.current) {
      isTypingRef.current = false;
      await channelRef.current.send({
        type: 'broadcast',
        event: 'stop_typing',
        payload: {
          user_id: currentUserIdRef.current,
        },
      });
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }, []);

  return {
    typingUsers,
    startTyping,
    stopTyping,
  };
}
