import { VenueBrandMark } from "@/components/venue/VenueBrandMark";
import type { Group } from "@/hooks/useGroups";
export function CommunityBrandMark({
  group,
  className,
}: {
  group: Pick<Group, "name" | "icon_url"> & { venue?: Group["venue"] };
  className?: string;
}) {
  const v = group.venue;
  return (
    <VenueBrandMark
      name={v?.name || group.name}
      logoUrl={v?.logo_url || group.icon_url}
      logoCrop={v?.logo_url ? v.logo_crop : undefined}
      logoShape={v?.logo_shape}
      logoImageFit={v?.logo_url ? v.logo_image_fit : "cover"}
      logoBackgroundColor={v?.logo_background_color}
      secondaryColor={v?.secondary_color}
      className={className}
    />
  );
}
