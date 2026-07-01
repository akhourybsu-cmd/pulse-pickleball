import { ReactNode, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  ArrowLeft, Menu, LayoutDashboard, Calendar, Users, Trophy, FileText,
  Shuffle, QrCode, Fingerprint, Shield, Activity, Megaphone, UserPlus,
  Building2, Archive, Swords, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Footer } from "@/components/Footer";
import logo from "@/assets/pulse-logo-premium.svg";
import { cn } from "@/lib/utils";

/**
 * Every admin surface renders inside this shell. Gives us one place to
 * fix header chrome, back nav, and the mobile drawer so subpages don't
 * each reinvent it.
 */

interface AdminNavItem {
  href: string;
  label: string;
  icon: typeof Users;
  group: "live" | "manage" | "diagnostics" | "advanced";
}

const NAV: AdminNavItem[] = [
  { href: "/admin/session",             label: "Sessions",         icon: Calendar,      group: "live" },
  { href: "/admin/manage",              label: "Live Session",     icon: Zap,           group: "live" },
  { href: "/admin/pairing",             label: "Auto Pair",        icon: Shuffle,       group: "live" },
  { href: "/qr-checkin",                label: "QR Check-In",      icon: QrCode,        group: "live" },
  { href: "/kiosk",                     label: "Kiosk Display",    icon: LayoutDashboard, group: "live" },

  { href: "/admin/players",             label: "Players",          icon: Users,         group: "manage" },
  { href: "/admin/matches",             label: "Matches",          icon: FileText,      group: "manage" },
  { href: "/admin/badges",              label: "Badges",           icon: Trophy,        group: "manage" },
  { href: "/pending-matches",           label: "Pending Matches",  icon: Trophy,        group: "manage" },

  { href: "/admin/system-health",       label: "System Health",    icon: Activity,      group: "diagnostics" },
  { href: "/admin/audit-log",           label: "Audit Log",        icon: Shield,        group: "diagnostics" },
  { href: "/admin/biometrics",          label: "Biometrics",       icon: Fingerprint,   group: "diagnostics" },

  { href: "/admin/test-accounts",       label: "Test Accounts",    icon: UserPlus,      group: "advanced" },
  { href: "/admin/marketing",           label: "Marketing",        icon: Megaphone,     group: "advanced" },
  { href: "/admin/venue-verification",  label: "Venue Claims",     icon: Building2,     group: "advanced" },
  { href: "/tournament-admin",          label: "Tournaments",      icon: Swords,        group: "advanced" },
  { href: "/archive",                   label: "Archive",          icon: Archive,       group: "advanced" },
];

const GROUP_LABEL: Record<AdminNavItem["group"], string> = {
  live: "Live ops",
  manage: "Players & matches",
  diagnostics: "Diagnostics",
  advanced: "Advanced",
};

interface AdminLayoutProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
}

export const AdminLayout = ({ title, subtitle, children }: AdminLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isDashboard = location.pathname === "/admin";

  const groups = (["live", "manage", "diagnostics", "advanced"] as const).map((g) => ({
    key: g,
    label: GROUP_LABEL[g],
    items: NAV.filter((n) => n.group === g),
  }));

  const goto = (href: string) => {
    setDrawerOpen(false);
    navigate(href);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header — single row, mobile-first */}
      <header className="sticky top-0 z-40 bg-[#0B171F] border-b border-slate-800">
        <div className="w-full max-w-[1280px] mx-auto px-4 lg:px-6 h-16 flex items-center gap-2">
          {/* Left: back to /admin (subpages) or logo (dashboard) */}
          {isDashboard ? (
            <Link to="/dashboard" className="flex items-center shrink-0">
              <img src={logo} alt="PULSE" className="h-8 w-auto" />
            </Link>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/admin")}
              className="text-slate-200 hover:bg-slate-800 hover:text-white -ml-2"
            >
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              <span className="hidden sm:inline">Admin</span>
            </Button>
          )}

          {/* Title (subpages only, truncates on narrow) */}
          {!isDashboard && title && (
            <div className="min-w-0 flex-1">
              <h1 className="text-sm sm:text-base font-semibold text-white truncate">
                {title}
              </h1>
            </div>
          )}

          {/* Right: drawer + theme */}
          <div className={cn("flex items-center gap-1.5", isDashboard && "ml-auto")}>
            <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-slate-200 hover:bg-slate-800 hover:text-white"
                  aria-label="Admin menu"
                >
                  <Menu className="w-4 h-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] sm:w-[340px] p-0">
                <SheetHeader className="px-5 pt-5 pb-3 border-b">
                  <SheetTitle className="text-left">Admin menu</SheetTitle>
                </SheetHeader>
                <nav className="overflow-y-auto max-h-[calc(100dvh-4rem)] py-2">
                  {groups.map((group) => (
                    <div key={group.key} className="py-2">
                      <div className="px-5 pb-1.5 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                        {group.label}
                      </div>
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        const active = location.pathname === item.href;
                        return (
                          <button
                            key={item.href}
                            type="button"
                            onClick={() => goto(item.href)}
                            className={cn(
                              "w-full text-left px-5 py-2.5 flex items-center gap-3 text-sm transition-colors",
                              active
                                ? "bg-primary/10 text-primary font-medium"
                                : "hover:bg-muted",
                            )}
                          >
                            <Icon className="w-4 h-4 shrink-0" />
                            <span className="truncate">{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  ))}
                  <div className="border-t mt-2 pt-2 px-5 pb-4">
                    <button
                      type="button"
                      onClick={() => goto("/player/dashboard")}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      ← Exit admin
                    </button>
                  </div>
                </nav>
              </SheetContent>
            </Sheet>
            <ThemeToggle />
          </div>
        </div>

        {/* Dashboard-only hero strip. Subpages get a tighter title-only header. */}
        {isDashboard && (
          <div className="px-4 lg:px-6 pb-5">
            <div className="max-w-[1280px] mx-auto">
              <h1 className="text-2xl md:text-3xl font-bold text-white">
                Admin Control Center
              </h1>
              {subtitle && (
                <p className="text-slate-400 text-sm mt-1">{subtitle}</p>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <Footer />
    </div>
  );
};
