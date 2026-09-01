import { describe, expect, it } from 'vitest';
import { initialVenueCommunityTab } from './navigation';

describe('venue community navigation', () => {
  it('opens a Social inbox venue link directly in chat', () => {
    expect(initialVenueCommunityTab(new URLSearchParams('tab=chat'))).toBe('chat');
  });

  it('defaults ordinary venue links to home', () => {
    expect(initialVenueCommunityTab(new URLSearchParams())).toBe('home');
    expect(initialVenueCommunityTab(new URLSearchParams('tab=unknown'))).toBe('home');
  });

  it('opens admin shortcuts at the requested venue destination', () => {
    expect(initialVenueCommunityTab(new URLSearchParams('tab=feed'))).toBe('feed');
    expect(initialVenueCommunityTab(new URLSearchParams('tab=book'))).toBe('book');
    expect(initialVenueCommunityTab(new URLSearchParams('tab=play'))).toBe('play');
    expect(initialVenueCommunityTab(new URLSearchParams('tab=more'))).toBe('more');
  });
});
