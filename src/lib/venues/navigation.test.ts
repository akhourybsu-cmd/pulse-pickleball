import { describe, expect, it } from 'vitest';
import { initialVenueCommunityTab, resolveVenueAdminTab, venueTabParams, type VenueCommunityTab } from './navigation';

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

  it('round-trips every tab without dropping other URL parameters or mutating the original', () => {
    const original = new URLSearchParams('source=social&tab=chat');
    for (const tab of ['home', 'book', 'play', 'feed', 'chat', 'more'] as VenueCommunityTab[]) {
      const next = venueTabParams(original, tab);
      expect(initialVenueCommunityTab(next)).toBe(tab);
      expect(next.get('source')).toBe('social');
    }
    expect(original.get('tab')).toBe('chat');
    expect(venueTabParams(original, 'home').has('tab')).toBe(false);
  });
});

describe('venue admin navigation', () => {
  it('restores each permitted settings page from a deep link', () => {
    for (const tab of ['overview', 'profile', 'modules', 'staff', 'facility', 'general', 'permissions', 'privacy', 'roles', 'danger']) {
      expect(resolveVenueAdminTab(tab, true, true, true)).toBe(tab);
    }
  });
  it('keeps venue-only managers out of community controls', () => {
    expect(resolveVenueAdminTab('roles', true, false, true)).toBe('overview');
    expect(resolveVenueAdminTab('danger', true, false, true)).toBe('overview');
  });
  it('keeps community-only moderators out of facility controls', () => {
    expect(resolveVenueAdminTab('facility', false, true, true)).toBe('general');
    expect(resolveVenueAdminTab('staff', false, true, true)).toBe('general');
  });
  it('falls back safely when a module or URL destination is unavailable', () => {
    expect(resolveVenueAdminTab('facility', true, true, false)).toBe('overview');
    expect(resolveVenueAdminTab('unknown', true, true, true)).toBe('overview');
    expect(resolveVenueAdminTab(null, false, true, false)).toBe('general');
  });
});
