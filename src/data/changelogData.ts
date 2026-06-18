import {
  Sparkles,
  Wrench,
  Shield,
  Zap,
  LayoutDashboard,
  UserCog,
  Building2,
  Trophy,
  Bell,
  TrendingUp,
  QrCode,
  Target,
  Fingerprint,
  Link2,
  MessageCircle,
  Users,
  RefreshCw,
  Calendar,
  Heart,
  type LucideIcon,
} from "lucide-react";

export interface ChangeCategory {
  name: string;
  icon: LucideIcon;
  changes: string[];
}

export interface ChangelogEntry {
  version: string;
  date: string;
  type: "major" | "feature" | "patch";
  title?: string;
  categories: ChangeCategory[];
}

export const changelog: ChangelogEntry[] = [
  {
    version: "2.3.0",
    date: "2026-06-18",
    type: "feature",
    title: "Sign-In Hardening & Live Updates",
    categories: [
      {
        name: "Authentication",
        icon: Shield,
        changes: [
          "Rebuilt Google and Apple sign-in so a successful login lands you on the dashboard every time — no more bounce back to the auth screen",
          "Added an OAuth recovery layer that finishes the handshake automatically when returning from Google / Apple",
          "Hardened session detection so the app waits for a confirmed session before routing",
          "Sanitized redirects to prevent post-login loops back to /auth",
        ],
      },
      {
        name: "Account Linking",
        icon: Link2,
        changes: [
          "New Linked Accounts panel in Profile → Security lets email-only users connect Google or Apple after the fact",
          "One-tap linking and unlinking with clear status indicators per provider",
        ],
      },
      {
        name: "Automatic Updates",
        icon: RefreshCw,
        changes: [
          "Service worker bumped to v5 — navigations always fetch fresh HTML so new releases appear without a hard refresh",
          "App now auto-reloads the moment a new build is activated",
          "Stale service workers are detected and unregistered to clear cached auth state",
        ],
      },
    ],
  },
  {
    version: "2.2.0",
    date: "2026-05-12",
    type: "feature",
    title: "Biometric Sign-In & Profile Refresh",
    categories: [
      {
        name: "Biometric Authentication",
        icon: Fingerprint,
        changes: [
          "Sign in with Face ID, Touch ID, or device biometrics via WebAuthn",
          "New verify-biometric-auth edge function for secure server-side validation",
          "Enroll, manage, and revoke biometric credentials from Profile → Security",
        ],
      },
      {
        name: "Profile Editor Redesign",
        icon: UserCog,
        changes: [
          "/profile/edit now lives inside the player shell with the standard header, bottom nav, and gradient wash",
          "Floating save bar that stays clear of the bottom navigation",
          "Preserves deep-link query params (focus, return) when redirecting",
          "First and last name are now required fields and enforced on save",
        ],
      },
      {
        name: "Notifications",
        icon: Bell,
        changes: [
          "Notification Center polish: swipe-to-delete, colored category icons, deep linking to the relevant screen",
          "38+ tournament notification triggers wired up with scheduled Cron alerts",
        ],
      },
    ],
  },
  {
    version: "2.1.0",
    date: "2026-03-20",
    type: "major",
    title: "Tournaments, Messaging & Social",
    categories: [
      {
        name: "Tournament System",
        icon: Trophy,
        changes: [
          "Launched the full tournament platform: discovery, registration, day-planner, seeding, and templates",
          "Single-page /tournament/:eventId/register flow with profile-readiness checks",
          "Custom tournament URLs with slug validation",
          "Unified event discovery — tournaments sync into the shared /player/find feed via a Postgres trigger",
          "Bidirectional event roster integration between venues and players",
        ],
      },
      {
        name: "Friends & Messaging",
        icon: MessageCircle,
        changes: [
          "New friendships and direct_messages systems with real-time delivery",
          "Supabase Presence powers live online status and typing indicators",
          "Bottom-anchored composer pattern for fast mobile messaging",
        ],
      },
      {
        name: "Community & Venues",
        icon: Heart,
        changes: [
          "Player favorite venues with a dedicated hook and UI",
          "Venue following + announcements creating a marketing flywheel",
          "Bidirectional venue ↔ community group linking with shared branding",
          "Public venue pages now bundle Schedule, Events, and Coaching in a tabbed bottom nav",
        ],
      },
      {
        name: "Payments",
        icon: Zap,
        changes: [
          "Stripe Connect architecture with platform fee routing",
          "Subscription tiers, feature limits, and admin bypass for internal accounts",
          "Financial transactions table with refund processing and full audit log",
        ],
      },
    ],
  },
  {
    version: "2.0.0",
    date: "2026-01-03",
    type: "major",
    title: "Community Hub Launch",
    categories: [
      {
        name: "New Features",
        icon: Sparkles,
        changes: [
          "Launched Community Hub with groups, posts, events, and file sharing",
          "Group creation with public, private, and invite-only options",
          "Group admin panel with roles, permissions, and privacy settings",
          "Drag-and-drop group reordering for personalized display",
          "Group events with RSVP and calendar integration",
          "Real-time group chat with message threads",
          "Post reactions and nested comments",
          "Comprehensive changelog with privacy & legal section",
        ],
      },
      {
        name: "Improvements",
        icon: Wrench,
        changes: [
          "Role hierarchy: Owner, Admin, Moderator, Member",
          "Premium UI refinements with better visual hierarchy",
          "Improved mobile responsiveness across all group views",
          "Group discovery with search and filters",
        ],
      },
    ],
  },
  {
    version: "1.8.0",
    date: "2025-12-15",
    type: "feature",
    title: "Dashboard Redesign",
    categories: [
      {
        name: "New Features",
        icon: LayoutDashboard,
        changes: [
          "New ProfileHero with a unified player overview",
          "SpacesPreviewRow for home court and groups at a glance",
          "StatsByCourtCard for venue-specific performance tracking",
          "Redesigned PerformanceModule with match history and trends",
          "ActivityModule with pending actions and notifications",
          "Mobile-responsive tab toggle for dashboard sections",
        ],
      },
      {
        name: "Improvements",
        icon: Wrench,
        changes: [
          "Animated win-rate ring",
          "Rating display with week-over-week delta",
          "Skeleton loading states everywhere",
        ],
      },
    ],
  },
  {
    version: "1.7.0",
    date: "2025-11-20",
    type: "major",
    title: "Venue Platform Launch",
    categories: [
      {
        name: "New Features",
        icon: Building2,
        changes: [
          "Comprehensive venue management platform",
          "Step-by-step venue onboarding wizard",
          "Courts, bookings, and events management",
          "Round Robin event system with fairness algorithms",
          "Venue kiosk mode for public displays",
          "Venue analytics dashboard with insights",
          "Custom venue branding (logos, colors)",
          "Public white-label venue landing pages",
          "Staff management with role-based access",
        ],
      },
    ],
  },
  {
    version: "1.6.0",
    date: "2025-10-02",
    type: "feature",
    title: "Session Queue System",
    categories: [
      {
        name: "New Features",
        icon: QrCode,
        changes: [
          "Session queue management system",
          "Kiosk display mode for organizers",
          "QR code check-in",
          "One active session per court enforcement",
        ],
      },
    ],
  },
  {
    version: "1.5.0",
    date: "2025-09-28",
    type: "feature",
    title: "PULSE Rating System",
    categories: [
      {
        name: "New Features",
        icon: TrendingUp,
        changes: [
          "PULSE rating system with cumulative calculations",
          "Provisional match bonuses for new players",
          "Match-type support (ladder, league, playoffs, casual)",
          "Weekly rating snapshots for trend tracking",
          "Margin-of-victory multipliers",
        ],
      },
    ],
  },
  {
    version: "1.4.0",
    date: "2025-09-20",
    type: "feature",
    title: "Badges & Court Connector",
    categories: [
      {
        name: "New Features",
        icon: Trophy,
        changes: [
          "Badge system with achievement tracking",
          "Court connector for finding playing partners",
          "Real-time participant notifications",
          "Paddle preferences and player metadata",
        ],
      },
    ],
  },
  {
    version: "1.3.0",
    date: "2025-09-10",
    type: "feature",
    title: "Match Approval Workflow",
    categories: [
      {
        name: "New Features",
        icon: Shield,
        changes: [
          "Match approval workflow for verified results",
          "Contested match system",
          "Detailed match analytics with point differential",
        ],
      },
    ],
  },
  {
    version: "1.2.0",
    date: "2025-08-25",
    type: "feature",
    title: "Authentication & Admin",
    categories: [
      {
        name: "New Features",
        icon: UserCog,
        changes: [
          "User authentication and profile management",
          "Admin dashboard and court management",
        ],
      },
      {
        name: "Security",
        icon: Shield,
        changes: [
          "Row-Level Security policies across all tables",
          "Secure session management",
        ],
      },
    ],
  },
  {
    version: "1.1.0",
    date: "2025-08-15",
    type: "feature",
    title: "Match Recording",
    categories: [
      {
        name: "New Features",
        icon: Target,
        changes: [
          "Match recording with basic rating system",
          "Win/loss tracking and match history view",
          "Mobile-optimized match entry",
        ],
      },
    ],
  },
  {
    version: "1.0.0",
    date: "2025-08-01",
    type: "major",
    title: "Initial Release",
    categories: [
      {
        name: "New Features",
        icon: Zap,
        changes: [
          "Initial release of PULSE",
          "Player profiles with customization",
          "Court database with locations",
          "Match tracking foundation",
          "Light/dark theme support",
        ],
      },
    ],
  },
];
