/**
 * Venue chrome.
 *
 * Header artwork uses secondary for its band and accent for its highlights.
 * Existing venues without an accent keep their primary-color highlights.
 * The wider semantic palette for pages, controls and logos lives in palette.ts.
 *
 * Colours arrive from a free-text column an organizer typed into, so nothing
 * here trusts its input: an unparseable colour yields no chrome and the caller
 * falls back to standard Pulse styling.
 */

export interface VenueContact {
  name: string;
  email?: string | null;
  phone?: string | null;
  group_id?: string | null;
}
export interface VenueBrand {
  logo_crop?: unknown;
  cover_crop?: unknown;
  logo_url?: string | null;
  logo_shape?: "circle" | "square" | null;
  logo_image_fit?: "cover" | "contain" | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  accent_color?: string | null;
  background_color?: string | null;
  surface_color?: string | null;
  text_color?: string | null;
  logo_background_color?: string | null;
  chat_background_color?: string | null;
  chat_incoming_color?: string | null;
  chat_outgoing_color?: string | null;
}

export interface VenueChrome {
  /** Header band. */
  backgroundImage: string;
  /** Hairline under the band, and the underline beneath the community name. */
  accent: string;
  /**
   * The accent as `#rrggbb`, or null when it fell back to Pulse's own token.
   * Callers that composite alpha onto the accent (`${accent}20`) must use this:
   * appending two hex digits to `hsl(var(--primary))` is not a colour, and the
   * browser silently drops the whole declaration.
   */
  accentHex: string | null;
  /** Ambient corner glow. */
  bloom: string;
  /** Bottom border of the band. */
  border: string;
}

/**
 * Expand and validate a CSS hex colour, returning `#rrggbb` lowercase.
 *
 * Returns null for anything else, including the `#rgba`/`#rrggbbaa` forms —
 * an alpha channel here would compound with the alpha this module appends and
 * produce a band that's accidentally transparent.
 */
export function normalizeHex(value: string | null | undefined): string | null {
  if (!value) return null;
  const raw = value.trim().toLowerCase();
  if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/.test(raw)) return null;

  if (raw.length === 4) {
    const [, r, g, b] = raw;
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return raw;
}

/** `#rrggbb` + an 0..1 alpha as an 8-digit hex, which every target browser takes. */
export function withAlpha(hex: string, alpha: number): string {
  const clamped = Math.max(0, Math.min(1, alpha));
  const byte = Math.round(clamped * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex}${byte}`;
}

/**
 * Build the header chrome for a venue, or null if it hasn't set usable colours.
 *
 * The band darkens along the same 158° axis the default ink band uses, so a
 * light brand colour still leaves white text legible at the bottom edge where
 * the title sits.
 */
export function venueChrome(venue: VenueBrand | null | undefined): VenueChrome | null {
  if (!venue) return null;

  const primary = normalizeHex(venue.accent_color) ?? normalizeHex(venue.primary_color);
  const secondary = normalizeHex(venue.secondary_color);

  // The band comes from the secondary colour and the accent from the primary.
  // Either alone is enough to feel branded; with neither, use Pulse's own.
  if (!primary && !secondary) return null;

  const band = secondary ?? '#1f2933';
  const accent = primary ?? 'hsl(var(--primary))';

  return {
    backgroundImage: `linear-gradient(158deg, ${withAlpha(band, 1)} 0%, ${withAlpha(
      band,
      0.82,
    )} 55%, #0f1216 100%)`,
    accent,
    accentHex: primary,
    bloom: primary ? withAlpha(primary, 0.22) : 'hsl(var(--primary) / 0.16)',
    border: primary ? withAlpha(primary, 0.45) : 'hsl(var(--primary) / 0.28)',
  };
}
