import { describe, expect, it } from 'vitest';
import { isSameSenderRun } from './grouping';

const message = (userId: string, createdAt: string) => ({
  user_id: userId,
  created_at: createdAt,
});

describe('group chat sender runs', () => {
  it('groups nearby messages from the same person', () => {
    expect(isSameSenderRun(
      message('alex', '2026-09-01T18:00:00Z'),
      message('alex', '2026-09-01T18:04:00Z'),
    )).toBe(true);
  });

  it('starts a new visual run when the sender changes', () => {
    expect(isSameSenderRun(
      message('alex', '2026-09-01T18:00:00Z'),
      message('jordan', '2026-09-01T18:01:00Z'),
    )).toBe(false);
  });

  it('repeats the sender label after a meaningful pause', () => {
    expect(isSameSenderRun(
      message('alex', '2026-09-01T18:00:00Z'),
      message('alex', '2026-09-01T18:06:00Z'),
    )).toBe(false);
  });
});
