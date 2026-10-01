import { normalizeHex } from "@/lib/venues/branding";
import { contrastInk, hexToHsl, readableColor } from "@/lib/venues/palette";
import type { ImageCrop } from "@/lib/venues/imageCrop";

export interface LeagueBrand {
  primary_color?: string;
  secondary_color?: string;
  accent_color?: string;
  logo_url?: string;
  cover_url?: string;
  logo_crop?: ImageCrop;
  cover_crop?: ImageCrop;
  logo_shape?: "circle" | "square";
  logo_fit?: "contain" | "cover";
}

export const LEAGUE_PALETTES = [
  {
    name: "PULSE",
    primary_color: "#c9962f",
    secondary_color: "#203b31",
    accent_color: "#e6c782",
  },
  {
    name: "Electric blue",
    primary_color: "#2563eb",
    secondary_color: "#172554",
    accent_color: "#67e8f9",
  },
  {
    name: "Courtside green",
    primary_color: "#16805d",
    secondary_color: "#12372b",
    accent_color: "#bef264",
  },
  {
    name: "Sunset",
    primary_color: "#e05d32",
    secondary_color: "#582344",
    accent_color: "#fbbf24",
  },
  {
    name: "Violet",
    primary_color: "#8955db",
    secondary_color: "#312052",
    accent_color: "#f0abfc",
  },
] as const;

/** Only validated hex enters CSS. Reading colors adapt to the current surface. */
export function leagueBrandStyle(
  brand?: LeagueBrand | null,
  dark = false
): Record<string, string> {
  if (!brand || !Object.keys(brand).length) return {};
  const p = normalizeHex(brand.primary_color) ?? "#c9962f";
  const secondary = normalizeHex(brand.secondary_color) ?? "#203b31";
  const accent = normalizeHex(brand.accent_color) ?? p;
  const primary = readableColor(p, dark ? "#24272c" : "#eeeae1");
  // Even a white header color remains dark enough for white text and cover overlays.
  const header =
    "#" +
    [1, 3, 5]
      .map((i) =>
        Math.round(parseInt(secondary.slice(i, i + 2), 16) * 0.3)
          .toString(16)
          .padStart(2, "0")
      )
      .join("");
  const heroAccent = readableColor(accent, "#505050");
  return {
    "--primary": hexToHsl(primary),
    "--primary-foreground": hexToHsl(contrastInk(primary)),
    "--accent": hexToHsl(primary),
    "--accent-foreground": hexToHsl(contrastInk(primary)),
    "--ring": hexToHsl(primary),
    "--lg-accent-gold": primary,
    "--lg-gold": primary,
    "--lg-eyebrow-bg": `${primary}14`,
    "--lg-eyebrow-ring": `${primary}40`,
    "--lg-hero-gold": heroAccent,
    "--lg-hero-radial": `${accent}08`,
    "--lg-hero-stops": `${header}, ${header}`,
    "--lg-hero-chip-bg": `${heroAccent}15`,
    "--lg-hero-chip-ring": `${heroAccent}55`,
    "--lg-court-line": `${heroAccent}12`,
    "--lg-hairline": `linear-gradient(90deg, ${primary}80, ${primary}08)`,
    "--league-header": header,
    "--league-header-glow": `${accent}08`,
    "--league-brand-accent": heroAccent,
    "--league-raw-primary": p,
  };
}
