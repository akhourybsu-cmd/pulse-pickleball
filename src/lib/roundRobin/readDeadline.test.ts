import { afterEach, describe, expect, it, vi } from 'vitest';
import { withReadDeadline } from './readDeadline';

afterEach(() => vi.useRealTimers());

describe('round-robin read deadline', () => {
  it('returns successful data and clears its timer', async () => {
    vi.useFakeTimers();
    expect(await withReadDeadline(async () => 'snapshot')).toBe('snapshot');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('preserves errors and cancels sibling reads', async () => {
    let signal: AbortSignal | undefined;
    await expect(withReadDeadline(async s => {
      signal = s;
      throw new Error('Read rejected');
    })).rejects.toThrow('Read rejected');
    expect(signal?.aborted).toBe(true);
  });

  it('bounds an unresponsive read even if it ignores abort', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const result = withReadDeadline(s => {
      signal = s;
      return new Promise(() => {});
    });
    const rejected = expect(result).rejects.toThrow('refresh timed out');
    await vi.advanceTimersByTimeAsync(20_000);
    await rejected;
    expect(signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('marks a late read aborted so it cannot commit a stale snapshot', async () => {
    vi.useFakeTimers();
    let finish!: () => void;
    const commit = vi.fn();
    const result = withReadDeadline(async signal => {
      await new Promise<void>(resolve => { finish = resolve; });
      if (!signal.aborted) commit();
    });
    const rejected = expect(result).rejects.toThrow('refresh timed out');
    await vi.advanceTimersByTimeAsync(20_000);
    await rejected;
    finish();
    await Promise.resolve();
    expect(commit).not.toHaveBeenCalled();
  });
});
