import { US_STATE_OPTIONS } from "@/lib/us-states";
import type { Group } from "@/hooks/useGroups";
export interface CommunityArea {
  city: string;
  state: string;
}
export function normalizeRegion(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase() ?? "";
  return (
    US_STATE_OPTIONS.find(
      (s) =>
        s.name.toLowerCase() === normalized ||
        s.code.toLowerCase() === normalized,
    )?.code.toLowerCase() ?? normalized
  );
}
export function communityLocation(
  group: Pick<Group, "city" | "state" | "venue">,
) {
  return {
    city: group.venue?.city?.trim() || group.city?.trim() || "",
    state: group.venue?.state?.trim() || group.state?.trim() || "",
  };
}
export function areaRank(
  group: Pick<Group, "city" | "state" | "venue">,
  area: CommunityArea,
) {
  const place = communityLocation(group);
  if (
    !area.state.trim() ||
    normalizeRegion(place.state) !== normalizeRegion(area.state)
  )
    return 2;
  return area.city.trim() &&
    place.city.toLowerCase() === area.city.trim().toLowerCase()
    ? 0
    : 1;
}
export function matchesCommunity(group: Group, search: string) {
  const place = communityLocation(group);
  const text = [
    group.name,
    group.description,
    group.venue?.name,
    group.venue?.tagline,
    place.city,
    place.state,
    normalizeRegion(place.state),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return search
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .every((term) => text.includes(term));
}
export function nearbyCommunities<T extends Group>(
  groups: T[],
  area: CommunityArea,
) {
  return [...groups].sort((a, b) => areaRank(a, area) - areaRank(b, area));
}
