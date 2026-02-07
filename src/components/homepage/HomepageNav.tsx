import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Menu, User, Building2, Calendar, Users, ArrowRight, LogIn, RotateCcw, Trophy, ChevronDown, LayoutDashboard, Settings, MoreHorizontal } from "lucide-react";
import { useUserVenues } from "@/hooks/useUserVenues";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/ThemeToggle";
import logo from "@/assets/pulse-logo-new.png";

interface HomepageNavProps {
  isLoggedIn: boolean;
  userMode?: "player" | "venue";
}

// Desktop navigation links
const desktopNavLinks = [
  { label: "Players", href: "/players", icon: User },
  { label: "Venues", href: "/venues", icon: Building2 },
  { label: "Events", href: "/events/browse", icon: Calendar },
  { label: "Community", href: "/player/community", icon: Users },
];

// Menu sections (used for both mobile and desktop)
const menuSections = {
  explore: {
    title: "Explore",
    items: [
      { label: "Players", href: "/players", icon: User },
      { label: "Venues", href: "/venues", icon: Building2 },
      { label: "Events", href: "/events/browse", icon: Calendar },
      { label: "Community", href: "/player/community", icon: Users },
    ],
  },
  play: {
    title: "Play",
    items: [
      { label: "Round Robins", href: "/round-robin", icon: RotateCcw },
    ],
    expandable: {
      label: "Tournaments",
      icon: Trophy,
      submenu: [
        { label: "Browse Tournaments", href: "/tournaments/browse" },
        { label: "Host a Tournament", href: "/tournaments/new" },
      ],
    },
  },
  account: {
    title: "Account",
    items: [
      { label: "Dashboard", href: "/player/dashboard", icon: LayoutDashboard },
      { label: "Settings", href: "/settings/notifications", icon: Settings },
    ],
  },
};

export const HomepageNav = ({ isLoggedIn, userMode }: HomepageNavProps) => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [tournamentsOpen, setTournamentsOpen] = useState(false);
  const { venues: userVenues, loading: venuesLoading } = useUserVenues();

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
              <DropdownMenuLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Play
              </DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <Link to="/round-robin" className="flex items-center gap-2 cursor-pointer">
                  <RotateCcw className="h-4 w-4" />
                  Round Robins
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="flex items-center gap-2">
                  <Trophy className="h-4 w-4" />
                  Tournaments
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="bg-popover">
                  <DropdownMenuItem asChild>
                    <Link to="/tournaments/browse" className="cursor-pointer">
                      Browse Tournaments
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/tournaments/new" className="cursor-pointer">
                      Host a Tournament
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              
              {isLoggedIn && userVenues.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    My Venues
                  </DropdownMenuLabel>
                  {userVenues.map((venue) => (
                    <DropdownMenuItem key={venue.id} asChild>
                      <Link to={venue.slug ? `/v/${venue.slug}` : '/venue'} className="flex items-center gap-2 cursor-pointer">
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={venue.logo_url || undefined} alt={venue.name} />
                          <AvatarFallback className="text-[10px] bg-muted">{venue.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <span className="truncate">{venue.name}</span>
                        <span className="ml-auto text-xs text-muted-foreground capitalize">{venue.role}</span>
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </>
              )}
              
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
                
                {/* Divider */}
                <div className="border-t border-border/50 my-2 mx-6" />
                
                {/* Play Section */}
                <div className="px-6 py-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 px-3">
                    {menuSections.play.title}
                  </p>
                  <div className="space-y-1">
                    {menuSections.play.items.map((link) => (
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
                    
                    {/* Tournaments Expandable */}
                    <Collapsible open={tournamentsOpen} onOpenChange={setTournamentsOpen}>
                      <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-3 rounded-lg text-base font-medium text-foreground hover:bg-muted/50 transition-colors min-h-[44px]">
                        <div className="flex items-center gap-3">
                          <Trophy className="h-5 w-5 text-muted-foreground" />
                          {menuSections.play.expandable.label}
                        </div>
                        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-150 ${tournamentsOpen ? 'rotate-180' : ''}`} />
                      </CollapsibleTrigger>
                      <CollapsibleContent className="overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
                        <div className="pl-8 space-y-1 mt-1">
                          {menuSections.play.expandable.submenu.map((subItem) => (
                            <Link
                              key={subItem.href}
                              to={subItem.href}
                              onClick={() => setMobileMenuOpen(false)}
                              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors min-h-[40px]"
                            >
                              {subItem.label}
                            </Link>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                </div>
                
                {/* My Venues Section (only if logged in and has venues) */}
                {isLoggedIn && userVenues.length > 0 && (
                  <>
                    <div className="border-t border-border/50 my-2 mx-6" />
                    <div className="px-6 py-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 px-3">
                        My Venues
                      </p>
                      <div className="space-y-1">
                        {userVenues.map((venue) => (
                          <Link
                            key={venue.id}
                            to={venue.slug ? `/v/${venue.slug}` : '/venue'}
                            onClick={() => setMobileMenuOpen(false)}
                            className="flex items-center gap-3 px-3 py-3 rounded-lg text-base font-medium text-foreground hover:bg-muted/50 transition-colors min-h-[44px]"
                          >
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={venue.logo_url || undefined} alt={venue.name} />
                              <AvatarFallback className="text-[10px] bg-muted">{venue.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <span className="truncate">{venue.name}</span>
                            <span className="ml-auto text-xs text-muted-foreground capitalize">{venue.role}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  </>
                )}

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
                  {getPrimaryCtaLabel()}
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
