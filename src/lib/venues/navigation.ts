export type VenueCommunityTab = 'home' | 'chat';

/** Resolve the venue's initial destination from a Social/deep-link URL. */
export function initialVenueCommunityTab(searchParams: URLSearchParams): VenueCommunityTab {
  return searchParams.get('tab') === 'chat' ? 'chat' : 'home';
}
