import { describe, expect, it } from "vitest";
import { venueAdminItems } from "@/lib/venues/adminNavigation";
import {
  filterVenueAdminItems,
  venueAdminSection,
  VENUE_ADMIN_SECTIONS,
} from "@/lib/venues/adminSections";

const owner = venueAdminItems({
  manage: true,
  programs: true,
  operate: true,
  desk: true,
  finance: true,
  community: true,
  facility: true,
});

describe("venue management discovery", () => {
  it("places every available tool into exactly one group", () => {
    for (const item of owner) {
      expect(
        VENUE_ADMIN_SECTIONS.filter(
          (section) => section.value === venueAdminSection(item),
        ),
      ).toHaveLength(1);
    }
    expect(
      venueAdminSection(owner.find((item) => item.value === "danger")!),
    ).toBe("advanced");
  });

  it("finds common staff terms, ignores case and combines search words", () => {
    expect(
      filterVenueAdminItems(owner, "  BRANDING  ").map((item) => item.value),
    ).toContain("profile");
    expect(
      filterVenueAdminItems(owner, "email provider").map((item) => item.value),
    ).toEqual(["integrations"]);
    expect(
      filterVenueAdminItems(owner, "cash desk").map((item) => item.value),
    ).toEqual(["desk"]);
    expect(filterVenueAdminItems(owner, "not-a-venue-tool")).toEqual([]);
    expect(filterVenueAdminItems(owner, "  ")).toEqual(owner);
  });

  it("never introduces owner or community tools into a staff search", () => {
    const staff = venueAdminItems({
      manage: false,
      programs: false,
      operate: true,
      desk: true,
      finance: false,
      community: false,
      facility: true,
    });
    for (const search of [
      "",
      "email",
      "branding",
      "refunds",
      "community",
      "staff",
      "business",
    ]) {
      const results = filterVenueAdminItems(staff, search);
      expect(results.every((item) => staff.includes(item))).toBe(true);
      expect(results.map((item) => item.value)).not.toContain("payments");
      expect(results.map((item) => item.value)).not.toContain("danger");
    }
  });
});
