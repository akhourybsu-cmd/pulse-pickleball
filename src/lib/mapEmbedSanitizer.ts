/**
 * Map Embed Sanitization Utility
 * Prevents XSS attacks by validating iframe sources against trusted domains
 */

const ALLOWED_MAP_DOMAINS = [
  'maps.google.com',
  'www.google.com/maps',
  'google.com/maps',
  'openstreetmap.org',
  'www.openstreetmap.org',
  'embed.openstreetmap.org',
  'maps.apple.com',
  'mapbox.com',
  'api.mapbox.com',
] as const;

/**
 * Sanitizes map embed HTML by validating iframe sources against allowlist
 * @param embed - Raw HTML embed code or URL
 * @returns Sanitized iframe HTML or null if invalid
 */
export const sanitizeMapEmbed = (embed: string | null | undefined): string | null => {
  if (!embed || typeof embed !== 'string') return null;

  const trimmedEmbed = embed.trim();
  if (!trimmedEmbed) return null;

  // Extract src from iframe tag if present
  const iframeMatch = trimmedEmbed.match(/<iframe[^>]*src=["']([^"']+)["'][^>]*>/i);
  const srcUrl = iframeMatch ? iframeMatch[1] : trimmedEmbed;

  // Validate URL format and domain
  try {
    const url = new URL(srcUrl);
    
    // Check if domain is in allowlist
    const isAllowed = ALLOWED_MAP_DOMAINS.some(domain => 
      url.hostname === domain || url.hostname.endsWith('.' + domain)
    );
    
    if (!isAllowed) {
      console.warn(`Map embed rejected: Domain ${url.hostname} not in allowlist`);
      return null;
    }

    // Ensure HTTPS
    if (url.protocol !== 'https:') {
      console.warn('Map embed rejected: Non-HTTPS URL');
      return null;
    }

    // Return sanitized iframe with controlled attributes
    return `<iframe src="${url.href}" width="100%" height="100%" style="border:0;" allowfullscreen="" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>`;
  } catch (error) {
    console.warn('Map embed rejected: Invalid URL format', error);
    return null;
  }
};

/**
 * Validates if a map embed is from a trusted source
 * @param embed - Raw HTML embed code or URL
 * @returns Boolean indicating if embed is valid
 */
export const isValidMapEmbed = (embed: string | null | undefined): boolean => {
  return sanitizeMapEmbed(embed) !== null;
};
