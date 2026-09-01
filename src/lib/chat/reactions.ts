export interface ReactionSummary {
  emoji: string;
  count: number;
  hasReacted: boolean;
}

/** Apply the signed-in user's optimistic reaction toggle immutably. */
export function toggleOwnReaction(
  current: ReactionSummary[],
  emoji: string,
): ReactionSummary[] {
  const reactions = current.map((reaction) => ({ ...reaction }));
  const index = reactions.findIndex((reaction) => reaction.emoji === emoji);

  if (index >= 0 && reactions[index].hasReacted) {
    const count = reactions[index].count - 1;
    if (count <= 0) reactions.splice(index, 1);
    else reactions[index] = { ...reactions[index], count, hasReacted: false };
  } else if (index >= 0) {
    reactions[index] = {
      ...reactions[index],
      count: reactions[index].count + 1,
      hasReacted: true,
    };
  } else {
    reactions.push({ emoji, count: 1, hasReacted: true });
  }

  return reactions;
}

/** Apply another member's realtime insert/delete without changing my state. */
export function applyRemoteReactionDelta(
  current: ReactionSummary[],
  emoji: string,
  delta: 1 | -1,
): ReactionSummary[] {
  const reactions = current.map((reaction) => ({ ...reaction }));
  const index = reactions.findIndex((reaction) => reaction.emoji === emoji);

  if (index < 0) {
    return delta > 0 ? [...reactions, { emoji, count: 1, hasReacted: false }] : reactions;
  }

  const count = reactions[index].count + delta;
  if (count <= 0) reactions.splice(index, 1);
  else reactions[index] = { ...reactions[index], count };
  return reactions;
}
