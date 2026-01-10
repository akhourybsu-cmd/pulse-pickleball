import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, X } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

interface HomepageNavProps {
  isLoggedIn: boolean;
  userMode?: "player" | "venue";
}

const navLinks = [
  { label: "Players", href: "/players" },
  { label: "Venues", href: "/venues" },
  { label: "Events", href: "/browse-events" },
  { label: "Community", href: "/player/community" },
  { label: "Pricing", href: "/pricing" },
];

export const HomepageNav = ({ isLoggedIn, userMode }: HomepageNavProps) => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handlePrimaryCTA = () => {
    if (isLoggedIn) {
      if (userMode === "venue") {
        navigate("/venue/dashboard");
      } else {
        navigate("/player/dashboard");
      }
    } else {
      navigate("/auth");
    }
  };

  const getPrimaryCtaLabel = () => {
    if (isLoggedIn) {
      return userMode === "venue" ? "Venue Manager" : "Go to Dashboard";
    }
    return "Get Started";
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <nav className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-secondary">
            <span className="text-primary-foreground font-bold text-lg">P</span>
          </div>
          <span className="font-display text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            PULSE
          </span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {link.label}
            </Link>
          ))}
          {!isLoggedIn && (
            <Link
              to="/auth"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Login
            </Link>
          )}
        </div>

        {/* Right Side Actions */}
        <div className="flex items-center gap-3">
          <ThemeToggle />
          
          {/* Desktop CTA */}
          <Button
            onClick={handlePrimaryCTA}
            className="hidden md:inline-flex bg-gradient-to-r from-secondary to-primary hover:opacity-90 transition-opacity"
          >
            {getPrimaryCtaLabel()}
          </Button>

          {/* Mobile Menu */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px] sm:w-[320px]">
              <div className="flex flex-col gap-6 mt-8">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    to={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-lg font-medium text-foreground hover:text-primary transition-colors"
                  >
                    {link.label}
                  </Link>
                ))}
                {!isLoggedIn && (
                  <Link
                    to="/auth"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-lg font-medium text-foreground hover:text-primary transition-colors"
                  >
                    Login
                  </Link>
                )}
                <Button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handlePrimaryCTA();
                  }}
                  className="mt-4 bg-gradient-to-r from-secondary to-primary"
                >
                  {getPrimaryCtaLabel()}
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </header>
  );
};
