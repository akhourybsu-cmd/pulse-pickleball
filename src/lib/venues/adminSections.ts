import type { VenueAdminNavItem } from "@/components/community/admin/VenueAdminShell";

export const VENUE_ADMIN_SECTIONS = [
  {
    value: "workspace",
    label: "Daily operations",
    tools: ["overview", "ops", "walk-ins", "desk", "check-in-stations"],
  },
  {
    value: "programming",
    label: "Programming",
    tools: ["events", "competitions", "appointments"],
  },
  {
    value: "people",
    label: "Players & messages",
    tools: ["players", "communications"],
  },
  {
    value: "business",
    label: "Business",
    tools: ["reports", "payments", "booking-policies"],
  },
  {
    value: "settings",
    label: "Venue settings",
    tools: ["profile", "facility", "staff", "integrations", "modules"],
  },
  {
    value: "community",
    label: "Community settings",
    tools: ["general", "permissions", "privacy", "roles"],
  },
  { value: "venue", label: "Venue", tools: [] },
  { value: "advanced", label: "Advanced", tools: ["danger"] },
] as const;

export function venueAdminSection(item: VenueAdminNavItem) {
  return (
    VENUE_ADMIN_SECTIONS.find((section) =>
      (section.tools as readonly string[]).includes(item.value),
    )?.value ??
    item.section ??
    "venue"
  );
}
const searchAliases: Record<string, string> = {
  profile: "branding logo photos images colors contact",
  ops: "calendar check-in attendance no-shows kiosk",
  players: "guests documents waivers",
  desk: "memberships cash products point of sale",
  facility: "court availability schedule opening times",
  "check-in-stations": "QR player kiosk",
  integrations: "email provider domain address resend sendgrid postmark",
  communications: "email messages announcements automation reminders",
  competitions: "round-robin tournament league matches",
};
export function filterVenueAdminItems(
  items: VenueAdminNavItem[],
  search: string,
) {
  const words = search.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return items.filter((item) =>
    words.every((word) =>
      `${item.label} ${searchAliases[item.value] || ""} ${item.shortLabel || ""} ${item.description} ${VENUE_ADMIN_SECTIONS.find((s) => s.value === venueAdminSection(item))?.label || ""}`
        .toLocaleLowerCase()
        .includes(word),
    ),
  );
}
