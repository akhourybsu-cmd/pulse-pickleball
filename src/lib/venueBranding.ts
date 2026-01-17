/**
 * Centralized venue branding utilities to ensure logos and colors are isolated per venue.
 * Each venue displays ONLY its own assets - no cross-venue bleeding.
 */

// Known unstable image hosts that should be ignored
const UNSTABLE_HOSTS = ['imgur.com', 'i.imgur.com'];

// Local fallbacks for known venues with local assets
const LOCAL_VENUE_ASSETS: Record<string, string> = {
  'pickleball-palace': '/venue-assets/pickleball-palace/logo.png',
};

// Generic placeholder for venues without logos
const GENERIC_VENUE_PLACEHOLDER = '/venue-assets/placeholder-venue.svg';

/**
 * Default colors used when a venue hasn't set custom branding.
 * Uses neutral, non-branded colors to avoid confusion.
 */
export const DEFAULT_VENUE_COLORS = {
  primary: '#6366F1',    // Neutral indigo
  secondary: '#374151',  // Neutral gray
} as const;

/**
 * Check if a URL is from an unstable host
 */
function isUnstableHost(url: string): boolean {
  try {
    const parsedUrl = new URL(url, window.location.origin);
    return UNSTABLE_HOSTS.some(host => parsedUrl.hostname.includes(host));
  } catch {
    return false;
  }
}

/**
 * Returns a reliable logo source for a venue.
 * 
 * Logic:
 * 1. If venue has a valid, stable logo URL → use it
 * 2. If venue has a local asset (by slug) → use local asset
 * 3. Otherwise → use generic placeholder
 * 
 * This ensures NO cross-venue logo bleeding.
 */
export function getVenueLogoSrc(
  logoUrl: string | null | undefined,
  venueName?: string | null,
  venueSlug?: string | null
): string {
  // If venue has a valid logo URL that's not from an unstable host, use it
  if (logoUrl && logoUrl.trim() !== '' && !isUnstableHost(logoUrl)) {
    return logoUrl;
  }

  // Check for local asset by slug
  if (venueSlug && LOCAL_VENUE_ASSETS[venueSlug]) {
    return LOCAL_VENUE_ASSETS[venueSlug];
  }

  // Check for local asset by name (legacy support)
  if (venueName) {
    const normalizedName = venueName.toLowerCase().replace(/\s+/g, '-');
    if (LOCAL_VENUE_ASSETS[normalizedName]) {
      return LOCAL_VENUE_ASSETS[normalizedName];
    }
    // Special case for Pickleball Palace with different naming
    if (venueName.toLowerCase().includes('pickleball palace')) {
      return LOCAL_VENUE_ASSETS['pickleball-palace'];
    }
  }

  // All other venues: use generic placeholder
  return GENERIC_VENUE_PLACEHOLDER;
}

/**
 * Get the fallback logo for error handling (onError prop).
 * Returns the generic placeholder to avoid cross-venue contamination.
 */
export function getVenueLogoFallback(): string {
  return GENERIC_VENUE_PLACEHOLDER;
}

/**
 * Get venue colors with proper fallbacks.
 * Always returns the venue's own colors or neutral defaults.
 */
export function getVenueColors(
  primaryColor?: string | null,
  secondaryColor?: string | null
): { primary: string; secondary: string } {
  return {
    primary: primaryColor || DEFAULT_VENUE_COLORS.primary,
    secondary: secondaryColor || DEFAULT_VENUE_COLORS.secondary,
  };
}
