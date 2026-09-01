/**
 * Venue chrome.
 *
 * A venue community should look like the venue and still read as Pulse. The
 * community header is a fixed piece of art — an ink gradient, a gold hairline,
 * an ambient bloom and a court watermark — so branding replaces the two colours
 * that carry identity (the band and the accent) and leaves the composition
 * alone. That keeps every venue recognisably the same product rather than
 * handing each one a blank canvas.
 *
 * Colours arrive from a free-text column an organizer typed into, so nothing
 * here trusts its input: an unparseable colour yields no chrome and the caller
 * falls back to standard Pulse styling.
 */

export interface VenueBrand {
  primary_color?: string | null;
  secondary_color?: string | null;
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

  const primary = normalizeHex(venue.primary_color);
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
