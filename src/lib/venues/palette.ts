import { normalizeHex, type VenueBrand } from './branding';

export const VENUE_COLOR_FIELDS = [
  { key: 'primary_color', label: 'Primary · buttons', hint: 'Booking and other main actions.' },
  { key: 'secondary_color', label: 'Secondary · brand assets', hint: 'Banner fallback and supporting venue artwork.' },
  { key: 'accent_color', label: 'Accent · highlights', hint: 'Active tabs, icons and highlights. Auto uses primary.' },
  { key: 'background_color', label: 'Page background', hint: 'The canvas behind your content. Auto follows light or dark mode.' },
  { key: 'surface_color', label: 'Cards & dialogs', hint: 'Content cards, menus and booking dialogs. Auto follows light or dark mode.' },
  { key: 'text_color', label: 'Text', hint: 'Main reading color. Adjusted where needed for readability.' },
  { key: 'logo_background_color', label: 'Logo background', hint: 'The tile behind your logo, separate from the header. Auto uses secondary.' },
] as const;

// Legacy surface fields remain in storage; player-facing PULSE surfaces are shared.
export const VENUE_BRAND_COLOR_FIELDS = VENUE_COLOR_FIELDS.filter(({ key }) =>
  !['background_color', 'surface_color', 'text_color'].includes(key));

function rgb(hex: string) { return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)); }
function luminance(hex: string) {
  const [r, g, b] = rgb(hex).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return .2126 * r + .7152 * g + .0722 * b;
}
export function contrastRatio(a: string, b: string) {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}
export function contrastInk(background: string) {
  return contrastRatio('#000000', background) >= contrastRatio('#ffffff', background) ? '#000000' : '#ffffff';
}
function mix(a: string, b: string, amount: number) {
  const target = rgb(b);
  return '#' + rgb(a).map((v, i) => Math.round(v + (target[i] - v) * amount).toString(16).padStart(2, '0')).join('');
}
/** Preserve the chosen hue where possible; all normal text reaches 4.5:1. */
export function readableColor(color: string, background: string) {
  const ink = contrastInk(background);
  for (let step = 0; step <= 20; step++) {
    const candidate = mix(color, ink, step / 20);
    if (contrastRatio(candidate, background) >= 4.5) return candidate;
  }
  return ink;
}
export function hexToHsl(hex: string) {
  const [r, g, b] = rgb(hex).map(v => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  const h = d === 0 ? 0 : max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return `${(h * 60).toFixed(2)} ${(s * 100).toFixed(2)}% ${(l * 100).toFixed(2)}%`;
}

export function resolveVenuePalette(brand: VenueBrand = {}, dark = false) {
  const primary = normalizeHex(brand.primary_color) ?? '#c9962f';
  const secondary = normalizeHex(brand.secondary_color) ?? '#1f2933';
  const accent = normalizeHex(brand.accent_color) ?? primary;
  const background = dark ? '#15171a' : '#f7f5ef';
  const surface = dark ? '#1e2024' : '#ffffff';
  const text = dark ? '#f4f4f5' : '#24272c';
  return { primary, secondary, accent, background, surface, text,
    pageText: readableColor(text, background), surfaceText: readableColor(text, surface),
    logoBackground: normalizeHex(brand.logo_background_color) ?? secondary };
}

/** Local semantic tokens also travel with portaled menus and booking dialogs. */
export function venueThemeStyle(brand: VenueBrand = {}, dark = false): Record<string, string> {
  const p = resolveVenuePalette(brand, dark);
  const muted = mix(p.background, p.pageText, .07);
  const tokens: Record<string, string> = {
    background: p.background, foreground: p.pageText,
    card: p.surface, 'card-foreground': p.surfaceText,
    popover: p.surface, 'popover-foreground': p.surfaceText,
    primary: p.primary, 'primary-foreground': contrastInk(p.primary),
    secondary: p.surface, 'secondary-foreground': p.surfaceText,
    accent: mix(p.surface, p.accent, .12), 'accent-foreground': readableColor(p.text, mix(p.surface, p.accent, .12)),
    muted, 'muted-foreground': readableColor(mix(p.pageText, p.background, .3), muted),
    border: mix(p.surface, p.surfaceText, .14), input: mix(p.surface, p.surfaceText, .4), ring: readableColor(p.primary, p.background),
    'venue-page-ink': p.pageText, 'venue-card-ink': p.surfaceText,
    'venue-page-muted': readableColor(mix(p.pageText, p.background, .3), p.background),
    'venue-card-muted': readableColor(mix(p.surfaceText, p.surface, .3), p.surface),
    'venue-page-link': readableColor(p.primary, p.background), 'venue-card-link': readableColor(p.primary, p.surface),
    'venue-page-highlight': readableColor(p.accent, p.background), 'venue-card-highlight': readableColor(p.accent, p.surface),
    'venue-action': p.primary, 'venue-on-action': contrastInk(p.primary),
    'venue-highlight': p.accent,
  };
  return {
    ...Object.fromEntries(Object.entries(tokens).map(([key, value]) => [`--${key}`, hexToHsl(value)])),
    '--club-accent': p.primary, '--club-on-accent': contrastInk(p.primary),
    '--venue-header': '#151b24', '--venue-on-header': '#ffffff', '--venue-cover-background': p.secondary,
    '--venue-header-highlight': readableColor(p.accent, '#151b24'),
    '--venue-logo-background': p.logoBackground, '--venue-on-logo': contrastInk(p.logoBackground),
  };
}
