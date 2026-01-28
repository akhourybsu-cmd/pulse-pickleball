import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Menu, User, Building2, Calendar, Users, ArrowRight, LogIn } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import logo from "@/assets/pulse-logo-new.png";

interface HomepageNavProps {
  isLoggedIn: boolean;
  userMode?: "player" | "venue";
}

// Navigation links with icons for mobile menu
const navLinks = [
  { label: "Players", href: "/players", icon: User },
  { label: "Venues", href: "/venues", icon: Building2 },
  { label: "Events", href: "/browse-events", icon: Calendar },
  { label: "Community", href: "/player/community", icon: Users },
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
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-secondary/95 backdrop-blur supports-[backdrop-filter]:bg-secondary/80">
      <nav className="container mx-auto flex h-[72px] items-center justify-between px-4">
        {/* Logo */}
        <Link to="/">
          <img 
            src={logo} 
            alt="PULSE Logo" 
            className="h-[60px] sm:h-[70px] w-auto cursor-pointer hover:opacity-80 transition-opacity" 
          />
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
          
          {/* Desktop CTA - Fixed contrast */}
          <Button
            onClick={handlePrimaryCTA}
            className="hidden md:inline-flex bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {getPrimaryCtaLabel()}
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
              {/* Header with logo */}
              <div className="p-6 border-b border-border/50 bg-secondary rounded-t-lg">
                <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                <Link 
                  to="/" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="inline-block"
                >
                  <img 
                    src={logo} 
                    alt="PULSE" 
                    className="h-12 w-auto" 
                  />
                </Link>
              </div>
              
              {/* Navigation section */}
              <div className="flex-1 p-6 space-y-6 overflow-y-auto">
                {/* Explore section */}
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 px-3">
                    Explore
                  </p>
                  {navLinks.map((link) => (
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
                
                {/* Divider */}
                <div className="border-t border-border/50" />
                
                {/* Auth section */}
                <div className="space-y-3">
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
                    {getPrimaryCtaLabel()}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </header>
  );
};
