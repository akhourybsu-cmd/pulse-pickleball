import { 
  Sparkles, 
  Wrench, 
  Bug, 
  Users, 
  LayoutDashboard, 
  MapPin, 
  Shield, 
  Zap,
  Calendar,
  MessageSquare,
  Upload,
  GripVertical,
  UserCog,
  Building2,
  Trophy,
  Bell,
  Star,
  Target,
  TrendingUp,
  QrCode,
  type LucideIcon
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
          "Added group creation with public, private, and invite-only options",
          "Implemented group admin panel with roles, permissions, and privacy settings",
          "Added group avatar upload for admins",
          "Implemented drag-and-drop group reordering for personalized display order",
          "Added group events with RSVP system and calendar integration",
          "Implemented real-time group chat with message threads",
          "Added post reactions and nested comments",
          "Implemented group file storage with member uploads",
          "Added comprehensive changelog with privacy & legal section",
        ]
      },
      {
        name: "Improvements",
        icon: Wrench,
        changes: [
          "Enhanced group member management with role hierarchy (Owner, Admin, Moderator, Member)",
          "Premium UI refinements with breathing room and visual hierarchy",
          "Improved mobile responsiveness across all group views",
          "Added group discovery with search and filters",
        ]
      }
    ]
  },
  {
    version: "1.9.0",
    date: "2025-12-28",
    type: "feature",
    title: "Demo Tour Overhaul",
    categories: [
      {
        name: "New Features",
        icon: Sparkles,
        changes: [
          "Completely rebuilt Demo Tour with realistic sample data",
          "Added interactive demo showcasing full dashboard experience",
          "Demo mode with 'Pickle Pete' sample profile",
          "Strategic CTAs guiding new users to sign up",
          "Demo match history with realistic statistics",
        ]
      },
      {
        name: "Improvements",
        icon: Wrench,
        changes: [
          "Enhanced onboarding flow with clearer value propositions",
          "Improved demo data accuracy for rating calculations",
          "Better demo-to-signup conversion flow",
        ]
      }
    ]
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
          "New ProfileHero component with unified player overview",
          "Added SpacesPreviewRow for home court and groups at a glance",
          "Added StatsByCourtCard for venue-specific performance tracking",
          "Redesigned PerformanceModule with match history and trends",
          "Added ActivityModule with pending actions and notifications",
          "Implemented mobile-responsive tab toggle for dashboard sections",
        ]
      },
      {
        name: "Improvements",
        icon: Wrench,
        changes: [
          "Added win rate visualization ring with animated progress",
          "Enhanced rating display with week-over-week delta indicator",
          "Improved data loading states with skeleton placeholders",
          "Better visual hierarchy across all dashboard cards",
        ]
      }
    ]
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
          "Launched comprehensive venue management platform",
          "Added venue onboarding wizard with step-by-step setup",
          "Implemented venue courts, bookings, and events management",
          "Added Round Robin event system with fairness algorithms",
          "Added venue kiosk mode for public displays",
          "Implemented venue analytics dashboard with insights",
          "Added venue branding with custom logos and colors",
          "Launched public venue landing pages (white-label ready)",
          "Added venue staff management with role-based access",
        ]
      },
      {
        name: "Improvements",
        icon: Wrench,
        changes: [
          "Enhanced venue search with location-based discovery",
          "Improved booking flow with real-time availability",
          "Better venue-player connection tools",
        ]
      }
    ]
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
          "Added session queue management system",
          "Implemented kiosk display mode for organizers",
          "Added QR code check-in functionality",
          "Enforced one active session per court rule",
          "Removed admin-only restriction for creating sessions",
          "Added organizer-specific kiosk access control",
        ]
      },
      {
        name: "Improvements",
        icon: Wrench,
        changes: [
          "Moved 'Record New Match' button to top of dashboard",
          "Improved session flow for faster check-ins",
        ]
      }
    ]
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
          "Implemented PULSE rating system with cumulative calculations",
          "Added provisional match bonuses for new players",
          "Enhanced match type support (ladder, league, playoffs, casual)",
          "Added weekly rating snapshots for trend tracking",
        ]
      },
      {
        name: "Improvements",
        icon: Wrench,
        changes: [
          "Improved rating calculation with margin of victory multipliers",
          "Better opponent rating tracking for accuracy",
          "Enhanced rating display throughout the app",
        ]
      }
    ]
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
          "Launched badge system with achievement tracking",
          "Added court connector for finding playing partners",
          "Implemented real-time participant notifications",
          "Enhanced profile customization options",
          "Added paddle preferences and player metadata",
        ]
      }
    ]
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
          "Added match approval workflow for verified results",
          "Implemented contested match system",
          "Enhanced match history with detailed analytics",
          "Added point differential tracking",
        ]
      },
      {
        name: "Improvements",
        icon: Wrench,
        changes: [
          "Improved opponent rating calculations",
          "Better match verification flow",
        ]
      }
    ]
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
          "Added user authentication system",
          "Implemented profile management",
          "Created admin dashboard",
          "Added court management functionality",
        ]
      },
      {
        name: "Security",
        icon: Shield,
        changes: [
          "Enhanced security with Row-Level Security policies",
          "Implemented secure session management",
        ]
      }
    ]
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
          "Launched match recording feature",
          "Added basic rating system",
          "Implemented win/loss tracking",
          "Created match history view",
        ]
      },
      {
        name: "Improvements",
        icon: Wrench,
        changes: [
          "Added responsive design improvements",
          "Better mobile experience for recording matches",
        ]
      }
    ]
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
          "Basic player profiles with customization",
          "Court database setup with locations",
          "Match tracking foundation",
          "Light/dark theme support",
        ]
      }
    ]
  },
];
