import {
  CalendarDays,
  CreditCard,
  Gauge,
  LayoutDashboard,
  LayoutGrid,
  Lock,
  Palette,
  Plug,
  Settings,
  Shield,
  ShieldCheck,
  Trophy,
  Users,
  AlertTriangle,
  ShoppingBag,
  QrCode,
  MessageSquare,
  BarChart3,
  UserRound,
} from "lucide-react";
import type { VenueAdminNavItem } from "@/components/community/admin/VenueAdminShell";

export function venueAdminItems(access: {
  finance?: boolean;
  manage: boolean;
  programs: boolean;
  operate: boolean;
  desk?: boolean;
  community: boolean;
  facility: boolean;
  privateSample?: boolean;
}): VenueAdminNavItem[] {
  const item = (
    value: string,
    label: string,
    description: string,
    icon: VenueAdminNavItem["icon"],
    section: VenueAdminNavItem["section"] = "venue",
  ): VenueAdminNavItem => ({
    value,
    label,
    description,
    icon,
    section,
    shortLabel: (
      {
        events: "Events & sign-ups",
        competitions: "Round robins & leagues",
        appointments: "Lessons & bookings",
        desk: "Front desk",
        "check-in-stations": "Check-in stations",
        "booking-policies": "Booking rules & rates",
      } as Record<string, string>
    )[value],
  });
  return [
    ...(access.manage
      ? [
          item(
            "overview",
            "Overview",
            "Venue health and shortcuts",
            LayoutDashboard,
          ),
        ]
      : []),
    ...(access.operate
      ? [
          item(
            "ops",
            "Operations",
            "Calendar, check-in and daily attendance",
            Gauge,
          ),
        ]
      : []),
    ...(access.programs
      ? [
          item(
            "events",
            "Events & registrations",
            "Schedule, courts, pricing and players",
            CalendarDays,
          ),
          item(
            "competitions",
            "Round robins & leagues",
            "Match play, seasons and standings",
            Trophy,
          ),
        ]
      : []),
    ...(access.desk
      ? [
          item(
            "walk-ins",
            "Walk-ins & visits",
            "Guest bookings and daily attendance",
            Users,
          ),
          item(
            "appointments",
            "Lessons & private bookings",
            "Coaches, quotes, deposits and court blocks",
            CalendarDays,
          ),
          item(
            "players",
            "Players & waivers",
            "Player records, guests and first visits",
            UserRound,
          ),
          item(
            "desk",
            "Front desk & memberships",
            "Sales, passes and cash reconciliation",
            ShoppingBag,
          ),
          item(
            "check-in-stations",
            "Player check-in kiosks",
            "Venue QR stations and private check-in",
            QrCode,
          ),
          ...(access.manage
            ? [
                item(
                  "booking-policies",
                  "Booking rules & rates",
                  "Pricing, member windows and holidays",
                  CalendarDays,
                ),
                item(
                  "communications",
                  "Communications",
                  "Branded email, player messages and automated reminders",
                  MessageSquare,
                ),
                item(
                  "reports",
                  "Reports",
                  "Revenue, attendance and court use",
                  BarChart3,
                ),
              ]
            : []),
        ]
      : []),
    ...(access.finance
      ? [
          item(
            "payments",
            "Payments & refunds",
            "Venue payment setup and purchases",
            CreditCard,
          ),
        ]
      : []),
    ...(access.manage
      ? [
          item(
            "profile",
            "Profile & brand",
            "Identity, imagery and contact details",
            Palette,
          ),
          ...(access.facility
            ? [
                item(
                  "facility",
                  "Courts & hours",
                  "Booking inventory and availability",
                  LayoutGrid,
                ),
              ]
            : []),
          item(
            "staff",
            "Staff access",
            "Venue roles and operations access",
            ShieldCheck,
          ),
          item(
            "integrations",
            "Integrations",
            "Venue address and connected services",
            Plug,
          ),
          item(
            "modules",
            access.privateSample ? "Included features" : "Plan & upgrades",
            "Venue features and subscriptions",
            ShieldCheck,
          ),
        ]
      : []),
    ...(access.community
      ? [
          item(
            "general",
            "Community profile",
            "Name, description and identity",
            Settings,
            "community",
          ),
          item(
            "permissions",
            "Member permissions",
            "Posting and chat controls",
            Shield,
            "community",
          ),
          item(
            "privacy",
            "Access & privacy",
            "Visibility, joining and invite codes",
            Lock,
            "community",
          ),
          item(
            "roles",
            "Community roles",
            "Owner and moderator authority",
            Users,
            "community",
          ),
          item(
            "danger",
            "Danger zone",
            "Transfer or delete this community",
            AlertTriangle,
            "advanced",
          ),
        ]
      : []),
  ];
}
export function venueAdminHref(groupId: string, tab: string) {
  const base = `/player/community/group/${groupId}`;
  if (["communications", "reports", "appointments"].includes(tab))
    return `${base}/${tab}`;
  if (tab === "players") return `${base}/players`;
  if (tab === "desk") return `${base}/desk`;
  if (tab === "walk-ins") return `${base}/walk-ins`;
  if (tab === "check-in-stations") return `${base}/check-in-stations`;
  if (tab === "booking-policies") return `${base}/booking-policies`;
  if (tab === "payments") return `${base}/payments`;
  return tab === "ops"
    ? `${base}/ops`
    : tab === "events"
      ? `${base}/events/manage`
      : tab === "competitions"
        ? `${base}/competitions`
        : `${base}/manage?tab=${tab}`;
}
