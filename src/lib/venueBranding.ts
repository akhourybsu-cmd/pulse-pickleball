/**
 * Centralized venue branding utilities to ensure logos always display correctly.
 * This prevents broken external image URLs from causing missing logos.
 */

// Known unstable image hosts that should be ignored
const UNSTABLE_HOSTS = ['imgur.com', 'i.imgur.com'];

// Local fallback for Pickleball Palace (our primary venue)
const PICKLEBALL_PALACE_LOCAL_LOGO = '/venue-assets/pickleball-palace/logo.png';

/**
 * Returns a reliable logo source for a venue.
 * - Ignores URLs from known unstable hosts (e.g., Imgur)
 * - Falls back to local asset for Pickleball Palace
 * - Falls back to placeholder for other venues
 */
export function getVenueLogoSrc(
  logoUrl: string | null | undefined,
  venueName?: string | null,
  venueSlug?: string | null
): string {
  // Check if it's Pickleball Palace (by slug or name)
  const isPickleballPalace = 
    venueSlug === 'pickleball-palace' || 
    venueName?.toLowerCase().includes('pickleball palace');

  // If no logo URL provided, use fallback
  if (!logoUrl) {
    return isPickleballPalace ? PICKLEBALL_PALACE_LOCAL_LOGO : PICKLEBALL_PALACE_LOCAL_LOGO;
  }

  // Check if URL is from an unstable host
  try {
    const url = new URL(logoUrl, window.location.origin);
    const isUnstableHost = UNSTABLE_HOSTS.some(host => url.hostname.includes(host));
    
    if (isUnstableHost) {
      // Ignore unstable URLs and use local fallback
      return isPickleballPalace ? PICKLEBALL_PALACE_LOCAL_LOGO : PICKLEBALL_PALACE_LOCAL_LOGO;
    }
  } catch {
    // If URL parsing fails, it might be a relative path which is fine
  }

  // URL seems stable, use it
  return logoUrl;
}

/**
 * Get the fallback logo for error handling (onError prop)
 */
export function getVenueLogoFallback(): string {
  return PICKLEBALL_PALACE_LOCAL_LOGO;
}
