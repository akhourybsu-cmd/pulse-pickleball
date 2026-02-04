import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  MapPin, 
  CalendarDays,
  GraduationCap,
  Users,
  Settings,
  Menu,
  BarChart3,
  Repeat,
  Trophy,
  Calendar,
  MoreHorizontal
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ModeSwitcher } from '@/components/mode/ModeSwitcher';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useState, useMemo, useCallback, CSSProperties } from 'react';
import { useMode } from '@/contexts/ModeContext';
import { getVenueLogoSrc, getVenueLogoFallback } from '@/lib/venueBranding';
import { VenueErrorBoundary } from '@/components/venue/VenueErrorBoundary';

import { Palette, Building2, Image } from 'lucide-react';

// Navigation structure with groups for sidebar
const navGroups = [
  {
    label: 'Overview',
    items: [
      { to: '/venue', icon: LayoutDashboard, label: 'Overview', end: true },
      { to: '/venue/analytics', icon: BarChart3, label: 'Analytics' },
    ]
  },
  {
    label: 'Venue Setup',
    items: [
      { to: '/venue/profile', icon: Building2, label: 'Profile' },
      { to: '/venue/branding', icon: Palette, label: 'Branding' },
      { to: '/venue/facility', icon: MapPin, label: 'Facility' },
      { to: '/venue/media', icon: Image, label: 'Media' },
    ]
  },
  {
    label: 'Operations',
    items: [
      { to: '/venue/courts', icon: MapPin, label: 'Courts' },
      { to: '/venue/bookings', icon: Calendar, label: 'Bookings' },
      { to: '/venue/events', icon: CalendarDays, label: 'Events' },
      { to: '/venue/tournaments', icon: Trophy, label: 'Tournaments' },
      { to: '/venue/round-robins', icon: Repeat, label: 'Round Robins' },
      { to: '/venue/coaching', icon: GraduationCap, label: 'Coaching' },
    ]
  },
  {
    label: 'Team',
    items: [
      { to: '/venue/staff', icon: Users, label: 'Staff' },
    ]
  },
  {
    label: 'Admin',
    items: [
      { to: '/venue/settings', icon: Settings, label: 'Settings' },
    ]
  },
];

// Flat nav items for reference
const allNavItems = navGroups.flatMap(g => g.items);

// Primary bottom nav items (5 max for mobile)
const bottomNavItems = [
  { to: '/venue', icon: LayoutDashboard, label: 'Overview', end: true },
  { to: '/venue/events', icon: CalendarDays, label: 'Events' },
  { to: '/venue/courts', icon: MapPin, label: 'Courts' },
  { to: '/venue/bookings', icon: Calendar, label: 'Bookings' },
  { to: '/venue/more', icon: MoreHorizontal, label: 'More', isMoreMenu: true },
];

// Items shown in the "More" menu (everything else)
const moreMenuItems = [
  { to: '/venue/tournaments', icon: Trophy, label: 'Tournaments' },
  { to: '/venue/round-robins', icon: Repeat, label: 'Round Robins' },
  { to: '/venue/coaching', icon: GraduationCap, label: 'Coaching' },
  { to: '/venue/profile', icon: Building2, label: 'Profile' },
  { to: '/venue/branding', icon: Palette, label: 'Branding' },
  { to: '/venue/facility', icon: MapPin, label: 'Facility' },
  { to: '/venue/media', icon: Image, label: 'Media' },
  { to: '/venue/staff', icon: Users, label: 'Staff' },
  { to: '/venue/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/venue/settings', icon: Settings, label: 'Settings' },
];

// Prefetch map for route preloading on hover - ALL venue routes for fast navigation
const prefetchMap: Record<string, () => Promise<unknown>> = {
  '/venue': () => import('@/pages/venue/VenueOverview'),
  '/venue/profile': () => import('@/pages/venue/VenueProfile'),
  '/venue/branding': () => import('@/pages/venue/VenueBranding'),
  '/venue/facility': () => import('@/pages/venue/VenueFacility'),
  '/venue/media': () => import('@/pages/venue/VenueMedia'),
  '/venue/courts': () => import('@/pages/venue/VenueCourts'),
  '/venue/bookings': () => import('@/pages/venue/VenueBookings'),
  '/venue/events': () => import('@/pages/venue/VenueEvents'),
  '/venue/tournaments': () => import('@/pages/venue/VenueTournaments'),
  '/venue/round-robins': () => import('@/pages/venue/VenueRoundRobins'),
  '/venue/coaching': () => import('@/pages/venue/VenueCoaching'),
  '/venue/staff': () => import('@/pages/venue/VenueStaff'),
  '/venue/analytics': () => import('@/pages/venue/VenueAnalytics'),
  '/venue/settings': () => import('@/pages/venue/VenueSettings'),
};

interface VenueTheme {
  primary: string;
  primaryForeground: string;
  secondary: string;
}

function useVenueTheme(): VenueTheme {
  const { currentVenue } = useMode();
  
  // Import centralized defaults to avoid cross-venue color bleeding
  const { DEFAULT_VENUE_COLORS } = require('@/lib/venueBranding');
  
  return useMemo(() => ({
    primary: currentVenue?.primary_color || DEFAULT_VENUE_COLORS.primary,
    primaryForeground: '#ffffff',
    secondary: currentVenue?.secondary_color || DEFAULT_VENUE_COLORS.secondary,
  }), [currentVenue?.primary_color, currentVenue?.secondary_color]);
}

function SidebarContent({ onItemClick }: { onItemClick?: () => void }) {
  const location = useLocation();
  const { currentVenue } = useMode();
  const venueTheme = useVenueTheme();

  // Use centralized branding helper for reliable logo display
  const logoSrc = getVenueLogoSrc(currentVenue?.logo_url, currentVenue?.venue_name);

  return (
    <div className="flex flex-col h-full">
      {/* Premium Dark Logo Section */}
      <div 
        className="p-4 mx-2 mt-2 rounded-lg"
        style={{ 
          backgroundColor: venueTheme.secondary,
          borderBottom: `2px solid ${venueTheme.primary}40`
        }}
      >
        <NavLink to="/venue" onClick={onItemClick} className="block">
          <img 
            src={logoSrc} 
            alt={currentVenue?.venue_name || "Venue"} 
            className="h-16 w-auto mx-auto cursor-pointer hover:opacity-90 transition-opacity"
            onError={(e) => {
              e.currentTarget.src = getVenueLogoFallback();
            }}
          />
        </NavLink>
        {currentVenue && (
          <div className="mt-3 text-center">
            <p className="text-sm font-semibold text-white truncate">{currentVenue.venue_name}</p>
            <p 
              className="text-xs capitalize font-medium"
              style={{ color: venueTheme.primary }}
            >
              {currentVenue.role}
            </p>
          </div>
        )}
      </div>

      {/* Grouped Navigation */}
      <nav className="flex-1 p-4 space-y-4 overflow-y-auto">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 mb-2">
              {group.label}
            </p>
            <div className="space-y-1">
              {group.items.map((item) => {
                const isActive = item.end 
                  ? location.pathname === item.to
                  : location.pathname.startsWith(item.to);
                
                const activeStyle: CSSProperties = isActive ? {
                  backgroundColor: `${venueTheme.primary}15`,
                  color: venueTheme.primary,
                } : {};
                
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={onItemClick}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm',
                      isActive 
                        ? 'font-medium' 
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    )}
                    style={activeStyle}
                  >
                    <item.icon 
                      className="h-4 w-4 flex-shrink-0" 
                      style={isActive ? { color: venueTheme.primary } : undefined}
                    />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom Actions */}
      <div className="p-4 border-t space-y-2">
        <div className="flex items-center justify-between">
          <ThemeToggle />
          <ModeSwitcher />
        </div>
      </div>
    </div>
  );
}

export function VenueShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const { currentVenue } = useMode();
  const venueTheme = useVenueTheme();
  const location = useLocation();

  // Use centralized branding helper for reliable logo display
  const logoSrc = getVenueLogoSrc(currentVenue?.logo_url, currentVenue?.venue_name);

  // Calculate active tab index for sliding indicator (exclude "More" from active state)
  const activeIndex = bottomNavItems.findIndex(item => {
    if (item.isMoreMenu) return false;
    return item.end 
      ? location.pathname === item.to
      : location.pathname.startsWith(item.to);
  });

  // Check if current path is in the "More" menu items
  const isMoreItemActive = moreMenuItems.some(item => 
    location.pathname === item.to || location.pathname.startsWith(item.to + '/')
  );

  // Prefetch route on hover
  const handlePrefetch = useCallback((to: string) => {
    const prefetch = prefetchMap[to];
    if (prefetch) prefetch();
  }, []);

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 border-r bg-sidebar flex-col fixed h-screen">
        <SidebarContent />
      </aside>

      {/* Mobile Header + Sheet - Premium Dark */}
      <div 
        className="lg:hidden fixed top-0 left-0 right-0 z-50"
        style={{ backgroundColor: venueTheme.secondary }}
      >
        {/* Gold accent bar */}
        <div 
          className="h-[3px] w-full"
          style={{ backgroundColor: venueTheme.primary }}
        />
        <div className="flex items-center justify-between px-4 py-3">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64">
              <SidebarContent onItemClick={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>

          <div className="flex items-center gap-2">
            <NavLink to="/venue">
              <img 
                src={logoSrc} 
                alt={currentVenue?.venue_name || "Venue"} 
                className="h-10 w-auto cursor-pointer hover:opacity-90 transition-opacity"
                onError={(e) => {
                  e.currentTarget.src = getVenueLogoFallback();
                }}
              />
            </NavLink>
            {currentVenue && (
              <span className="text-white text-sm font-medium truncate max-w-[120px]">
                {currentVenue.venue_name}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <ModeSwitcher />
          </div>
        </div>
      </div>

      {/* Main Content - Wrapped in error boundary for graceful error handling */}
      <main className="flex-1 lg:ml-64 pt-16 lg:pt-0 pb-24 lg:pb-0">
        <VenueErrorBoundary>
          <div className="min-h-screen">
            <Outlet />
          </div>
        </VenueErrorBoundary>
      </main>

      {/* Bottom Navigation - Mobile Only */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 border-t bg-card/95 backdrop-blur-sm pb-[env(safe-area-inset-bottom)]">
        {/* Sliding active indicator */}
        <div
          className="absolute top-0 h-[3px] rounded-full transition-all duration-[240ms] ease-out"
          style={{
            backgroundColor: venueTheme.primary,
            width: `${100 / bottomNavItems.length * 0.6}%`,
            left: activeIndex >= 0 ? `${(100 / bottomNavItems.length) * activeIndex + (100 / bottomNavItems.length) * 0.2}%` : '0%',
            opacity: activeIndex >= 0 ? 1 : 0,
          }}
        />
        <div className="flex items-center justify-around py-2">
          {bottomNavItems.map((item) => {
            // Handle "More" button separately
            if (item.isMoreMenu) {
              return (
                <Sheet key="more" open={moreMenuOpen} onOpenChange={setMoreMenuOpen}>
                  <SheetTrigger asChild>
                    <button
                      className={cn(
                        'flex flex-col items-center gap-1 px-3 py-2 rounded-lg min-w-[60px]',
                        'transition-colors duration-[240ms] ease-out',
                        isMoreItemActive 
                          ? 'font-medium' 
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                      style={isMoreItemActive ? { color: venueTheme.primary } : undefined}
                    >
                      <item.icon 
                        className="h-5 w-5 transition-colors duration-[240ms] ease-out"
                        style={isMoreItemActive ? { color: venueTheme.primary } : undefined}
                      />
                      <span className="text-xs font-medium">{item.label}</span>
                    </button>
                  </SheetTrigger>
                  <SheetContent side="bottom" className="max-h-[70vh]">
                    <SheetHeader className="pb-4">
                      <SheetTitle>More Options</SheetTitle>
                    </SheetHeader>
                    <div className="grid grid-cols-3 gap-3 pb-8">
                      {moreMenuItems.map((menuItem) => {
                        const isActive = location.pathname === menuItem.to || 
                          location.pathname.startsWith(menuItem.to + '/');
                        return (
                          <NavLink
                            key={menuItem.to}
                            to={menuItem.to}
                            onClick={() => setMoreMenuOpen(false)}
                            className={cn(
                              'flex flex-col items-center gap-2 p-4 rounded-xl transition-colors',
                              isActive 
                                ? 'bg-primary/10' 
                                : 'hover:bg-muted'
                            )}
                            style={isActive ? { color: venueTheme.primary } : undefined}
                          >
                            <menuItem.icon 
                              className="h-6 w-6" 
                              style={isActive ? { color: venueTheme.primary } : undefined}
                            />
                            <span className={cn(
                              'text-xs text-center',
                              isActive ? 'font-medium' : 'text-muted-foreground'
                            )}>
                              {menuItem.label}
                            </span>
                          </NavLink>
                        );
                      })}
                    </div>
                  </SheetContent>
                </Sheet>
              );
            }

            const isActive = item.end 
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to);
            
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onMouseEnter={() => handlePrefetch(item.to)}
                className={cn(
                  'flex flex-col items-center gap-1 px-3 py-2 rounded-lg min-w-[60px]',
                  'transition-colors duration-[240ms] ease-out',
                  isActive 
                    ? 'font-medium' 
                    : 'text-muted-foreground hover:text-foreground'
                )}
                style={isActive ? { color: venueTheme.primary } : undefined}
              >
                <item.icon 
                  className="h-5 w-5 transition-colors duration-[240ms] ease-out"
                  style={isActive ? { color: venueTheme.primary } : undefined}
                />
                <span className="text-xs font-medium">{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>

      {/* Desktop Bottom Nav - Removed to avoid clutter, sidebar is sufficient */}
    </div>
  );
}

// Export the hook for use in other venue pages
export { useVenueTheme };
