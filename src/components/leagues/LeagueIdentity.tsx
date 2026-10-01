import { VenueBrandMark } from "@/components/venue/VenueBrandMark";
import { VenueCoverImage } from "@/components/venue/VenueCoverImage";
import type { LeagueBrand } from "@/lib/leagues/branding";

export function LeagueBrandMark({
  name,
  branding,
  className,
}: {
  name: string;
  branding?: LeagueBrand | null;
  className?: string;
}) {
  return (
    <VenueBrandMark
      name={name}
      logoUrl={branding?.logo_url}
      logoCrop={branding?.logo_crop}
      logoShape={branding?.logo_shape ?? "square"}
      logoImageFit={branding?.logo_fit ?? "cover"}
      logoBackgroundColor={branding?.primary_color ?? "#c9962f"}
      className={className}
    />
  );
}

export function LeagueCover({ branding }: { branding?: LeagueBrand | null }) {
  if (!branding?.cover_url) return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <VenueCoverImage src={branding.cover_url} crop={branding.cover_crop} />
      <div className="absolute inset-0 bg-black/75" />
    </div>
  );
}
