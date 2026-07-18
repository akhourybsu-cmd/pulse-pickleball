import { useCallback, useMemo } from 'react';
import { useFriendsPresenceContext } from '@/contexts/FriendsPresenceContext';

/**
 * Which of the given friends are currently online. Reads the single app-wide
 * presence subscription (FriendsPresenceProvider, mounted in PlayerShell) and
 * intersects it with `friendIds`, so a friend shows online whenever they have
 * the app open — not only while they're on the Friends tab.
 *
 * Public API is unchanged from the previous self-subscribing version.
 */
export function useFriendsPresence(friendIds: string[]) {
  const { onlineUserIds, isConnected } = useFriendsPresenceContext();

  const key = friendIds.join(',');
  const onlineFriends = useMemo(() => {
    const s = new Set<string>();
    for (const id of friendIds) {
      if (onlineUserIds.has(id)) s.add(id);
    }
    return s;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, onlineUserIds]);

  const isOnline = useCallback((userId: string) => onlineFriends.has(userId), [onlineFriends]);

  return {
    onlineFriends,
    onlineCount: onlineFriends.size,
    isOnline,
    isConnected,
  };
}
