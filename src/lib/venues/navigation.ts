export type VenueCommunityTab = 'home' | 'book' | 'play' | 'feed' | 'chat' | 'more';

const VENUE_TABS = new Set<VenueCommunityTab>(['home', 'book', 'play', 'feed', 'chat', 'more']);

/** Resolve the venue's initial destination from a Social/deep-link URL. */
export function initialVenueCommunityTab(searchParams: URLSearchParams): VenueCommunityTab {
  const tab = searchParams.get('tab') as VenueCommunityTab | null;
  return tab && VENUE_TABS.has(tab) ? tab : 'home';
}
