import { useMemo } from 'react';
import { useGroups, type GroupWithMembership } from './useGroups';

/**
 * Returns only the groups where the current user has admin powers
 * (owner or moderator). Used to gate RR → group posting.
 */
export function useAdminGroups() {
  const { myGroups, loading, currentUserId } = useGroups();

  const adminGroups = useMemo<GroupWithMembership[]>(
    () =>
      myGroups.filter(
        (g) =>
          g.membership?.role === 'owner' || g.membership?.role === 'moderator'
      ),
    [myGroups]
  );

  return { adminGroups, loading, currentUserId };
}
