import { describe, expect, it } from 'vitest';
import {
  anchoredScrollTop,
  isChatNearBottom,
  viewportResizeAnchoredScrollTop,
} from './scroll';

describe('premium chat scrolling', () => {
  it('follows new messages only while the reader is close to latest', () => {
    expect(isChatNearBottom({ scrollHeight: 1000, scrollTop: 420, clientHeight: 500 })).toBe(true);
    expect(isChatNearBottom({ scrollHeight: 1000, scrollTop: 300, clientHeight: 500 })).toBe(false);
  });

  it('keeps the same content under the reader when older history is prepended', () => {
    expect(anchoredScrollTop(120, 800, 1120)).toBe(440);
  });

  it('never returns a negative scroll position', () => {
    expect(anchoredScrollTop(0, 800, 700)).toBe(0);
  });

  it('keeps the same bottom-anchored bubble in place when the keyboard opens', () => {
    expect(viewportResizeAnchoredScrollTop(500, 500, 300, 1000)).toBe(700);
  });

  it('restores the previous position when the keyboard closes', () => {
    expect(viewportResizeAnchoredScrollTop(700, 300, 500, 1000)).toBe(500);
  });

  it('clamps keyboard anchoring to the scrollable range', () => {
    expect(viewportResizeAnchoredScrollTop(50, 500, 900, 1000)).toBe(0);
    expect(viewportResizeAnchoredScrollTop(900, 500, 300, 1000)).toBe(700);
  });
});
