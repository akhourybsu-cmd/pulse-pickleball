import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Menu, User, Calendar, Users, ArrowRight, LogIn, RotateCcw, LayoutDashboard, Settings, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Logo } from "@/components/Logo";

interface HomepageNavProps {
  isLoggedIn: boolean;
  /** Reserved for future venue-mode revival. Unused while the platform is
   *  player-only. Kept on the props so callers don't have to change shape. */
  userMode?: "player" | "venue";
}

/**
 * Player-only public navigation.
 *
 * Venue + tournament surfaces (Venues link, Tournaments expandable,
 * My Venues section, Venue Manager CTA) were stripped during the
 * player-focused beta. The routes still exist for direct navigation,
 * we just no longer surface them from the public chrome.
 */

// Desktop nav links — Events + Community are the two discovery surfaces
// a logged-out visitor can browse before signing up. The old "Players"
// link pointed to /players which is itself a marketing landing — redundant
// when the visitor is already on the homepage, so it's been removed.
const desktopNavLinks = [
  { label: "Events", href: "/events/browse", icon: Calendar },
  { label: "Community", href: "/player/community", icon: Users },
];

// Menu sections (used for the mobile sheet)
const menuSections = {
  explore: {
    title: "Explore",
    items: [
      { label: "Events", href: "/events/browse", icon: Calendar },
      { label: "Community", href: "/player/community", icon: Users },
    ],
  },
  account: {
    title: "Account",
    items: [
      { label: "Dashboard", href: "/player/dashboard", icon: LayoutDashboard },
      { label: "Settings", href: "/settings/notifications", icon: Settings },
    ],
  },
};

export const HomepageNav = ({ isLoggedIn }: HomepageNavProps) => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handlePrimaryCTA = () => {
    if (isLoggedIn) {
      navigate("/player/dashboard");
    } else {
      navigate("/auth");
    }
  };

  const primaryCtaLabel = isLoggedIn ? "Go to Dashboard" : "Get Started";

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-secondary/95 backdrop-blur supports-[backdrop-filter]:bg-secondary/80">
      <nav className="container mx-auto flex h-[72px] items-center justify-between px-4">
        {/* Logo — inherits cream from text-secondary-foreground so it
            blends into the dark sticky header instead of reading as a
            pasted card. */}
        <Link
          to="/"
          className="text-secondary-foreground hover:opacity-80 transition-opacity"
          aria-label="PULSE — home"
        >
          <Logo className="h-[60px] sm:h-[70px] w-auto" />
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-8">
          {desktopNavLinks.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {link.label}
            </Link>
          ))}
          {/* Desktop More Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground hover:text-foreground">
                More
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-popover">
              {/* "Play" section emptied during the player-only beta — the
                  Round Robins link routed to the catch-all /round-robin
                  hub which is no longer surfaced to players. Reaches RRs
                  via the dashboard's "My round robins" card instead. */}

              {isLoggedIn && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Account
                  </DropdownMenuLabel>
                  <DropdownMenuItem asChild>
                    <Link to="/player/dashboard" className="flex items-center gap-2 cursor-pointer">
                      <LayoutDashboard className="h-4 w-4" />
                      Dashboard
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/settings/notifications" className="flex items-center gap-2 cursor-pointer">
                      <Settings className="h-4 w-4" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                </>
              )}

              {!isLoggedIn && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/auth" className="flex items-center gap-2 cursor-pointer">
                      <LogIn className="h-4 w-4" />
                      Login
                    </Link>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Right Side Actions */}
        <div className="flex items-center gap-3">
          <ThemeToggle />

          {/* Desktop CTA */}
          <Button
            onClick={handlePrimaryCTA}
            className="hidden md:inline-flex bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {primaryCtaLabel}
          </Button>

          {/* Mobile Menu */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon" className="h-10 w-10">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="w-[300px] sm:w-[340px] p-0 flex flex-col"
            >
              {/* Header with logo — cream wordmark on the dark sheet header */}
              <div className="p-6 border-b border-border/50 bg-secondary rounded-t-lg">
                <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                <Link
                  to="/"
                  onClick={() => setMobileMenuOpen(false)}
                  className="inline-block text-secondary-foreground"
                  aria-label="PULSE — home"
                >
                  <Logo className="h-12 w-auto" />
                </Link>
              </div>

              {/* Navigation section */}
              <div className="flex-1 py-4 overflow-y-auto">
                {/* Explore Section */}
                <div className="px-6 py-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 px-3">
                    {menuSections.explore.title}
                  </p>
                  <div className="space-y-1">
                    {menuSections.explore.items.map((link) => (
                      <Link
                        key={link.href}
                        to={link.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-3 px-3 py-3 rounded-lg text-base font-medium text-foreground hover:bg-muted/50 transition-colors min-h-[44px]"
                      >
                        <link.icon className="h-5 w-5 text-muted-foreground" />
                        {link.label}
                      </Link>
                    ))}
                  </div>
                </div>

                {/* Play Section removed — the only item was a /round-robin
                    link that's been sunsetted from player navigation. */}

                {/* Account Section (only if logged in) */}
                {isLoggedIn && (
                  <>
                    <div className="border-t border-border/50 my-2 mx-6" />
                    <div className="px-6 py-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 px-3">
                        {menuSections.account.title}
                      </p>
                      <div className="space-y-1">
                        {menuSections.account.items.map((link) => (
                          <Link
                            key={link.href}
                            to={link.href}
                            onClick={() => setMobileMenuOpen(false)}
                            className="flex items-center gap-3 px-3 py-3 rounded-lg text-base font-medium text-foreground hover:bg-muted/50 transition-colors min-h-[44px]"
                          >
                            <link.icon className="h-5 w-5 text-muted-foreground" />
                            {link.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Footer CTA */}
              <div className="p-6 border-t border-border/50 space-y-3">
                {!isLoggedIn && (
                  <Link
                    to="/auth"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-3 rounded-lg text-base font-medium text-foreground hover:bg-muted/50 transition-colors min-h-[44px]"
                  >
                    <LogIn className="h-5 w-5 text-muted-foreground" />
                    Login
                  </Link>
                )}
                <Button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handlePrimaryCTA();
                  }}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground min-h-[44px]"
                  size="lg"
                >
                  {primaryCtaLabel}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </header>
  );
};
