/** Only a previously verified view of the same account can stay mounted while
 * its session is rechecked. A cached profile alone never establishes access. */
export function canPreserveAuthView(
  current: {
    isAuthenticated: boolean;
    user: { id: string } | null;
    profile: { id: string } | null;
  },
  userId: string
): boolean {
  return (
    current.isAuthenticated &&
    current.user?.id === userId &&
    current.profile?.id === userId
  );
}
