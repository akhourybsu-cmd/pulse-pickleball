import { describe, expect, it } from 'vitest';
import { applyRemoteReactionDelta, toggleOwnReaction } from './reactions';

describe('group chat reactions', () => {
  it('adds and removes the signed-in user without losing other reactions', () => {
    const original = [{ emoji: '👍', count: 2, hasReacted: false }];
    const added = toggleOwnReaction(original, '👍');
    const removed = toggleOwnReaction(added, '👍');

    expect(added).toEqual([{ emoji: '👍', count: 3, hasReacted: true }]);
    expect(removed).toEqual(original);
    expect(original).toEqual([{ emoji: '👍', count: 2, hasReacted: false }]);
  });

  it('removes an empty reaction pill', () => {
    expect(toggleOwnReaction([{ emoji: '🔥', count: 1, hasReacted: true }], '🔥')).toEqual([]);
  });

  it('applies remote changes while preserving whether I reacted', () => {
    const mine = [{ emoji: '🎉', count: 2, hasReacted: true }];
    expect(applyRemoteReactionDelta(mine, '🎉', 1)).toEqual([
      { emoji: '🎉', count: 3, hasReacted: true },
    ]);
    expect(applyRemoteReactionDelta(mine, '🎉', -1)).toEqual([
      { emoji: '🎉', count: 1, hasReacted: true },
    ]);
  });
});
