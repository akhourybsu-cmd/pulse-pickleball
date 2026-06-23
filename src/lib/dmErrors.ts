// Map errors thrown by the get_or_create_dm_conversation RPC (and other
// DM flows) to a friendly toast string.
//
// The RPC raises with ERRCODE 42501 and stable English messages like
// "You can only message friends", "This user is not accepting messages",
// "You can't message this user".

export function interpretDmError(err: unknown): string {
  const message =
    (err as { message?: string } | null)?.message ??
    (err as { error_description?: string } | null)?.error_description ??
    '';
  const lower = message.toLowerCase();

  if (/only message friends|are not friends|must be friends/.test(lower)) {
    return 'You can only message your friends. Send a friend request first.';
  }
  if (/not accepting/.test(lower)) {
    return 'This player is not accepting messages right now.';
  }
  if (/can.?t message|blocked/.test(lower)) {
    return "You can't message this player.";
  }
  if (/not authenticated/.test(lower)) {
    return 'Please sign in to send messages.';
  }
  if (/invalid recipient/.test(lower)) {
    return 'That player can no longer receive messages.';
  }
  return 'Could not open conversation. Please try again.';
}
