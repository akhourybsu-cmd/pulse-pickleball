import { describe, expect, it } from 'vitest';
import { initialVenueCommunityTab } from './navigation';

describe('venue community navigation', () => {
  it('opens a Social inbox venue link directly in chat', () => {
    expect(initialVenueCommunityTab(new URLSearchParams('tab=chat'))).toBe('chat');
  });

  it('defaults ordinary venue links to home', () => {
    expect(initialVenueCommunityTab(new URLSearchParams())).toBe('home');
    expect(initialVenueCommunityTab(new URLSearchParams('tab=feed'))).toBe('home');
  });
});
