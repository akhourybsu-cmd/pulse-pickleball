import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  MapPin, 
  Calendar, 
  CalendarDays,
  GraduationCap,
  Users,
  Settings,
  Menu,
  BarChart3,
  Repeat
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ModeSwitcher } from '@/components/mode/ModeSwitcher';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useState, useMemo, CSSProperties } from 'react';
import { useMode } from '@/contexts/ModeContext';
import { getVenueLogoSrc, getVenueLogoFallback } from '@/lib/venueBranding';

const navItems = [
  { to: '/venue', icon: LayoutDashboard, label: 'Overview', end: true },
  { to: '/venue/courts', icon: MapPin, label: 'Courts' },
  { to: '/venue/bookings', icon: Calendar, label: 'Bookings' },
  { to: '/venue/events', icon: CalendarDays, label: 'Events' },
  { to: '/venue/round-robins', icon: Repeat, label: 'Round Robins' },
  { to: '/venue/coaching', icon: GraduationCap, label: 'Coaching' },
  { to: '/venue/staff', icon: Users, label: 'Staff' },
  { to: '/venue/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/venue/settings', icon: Settings, label: 'Settings' },
];

// Bottom nav items (subset for mobile/desktop bottom bar)
const bottomNavItems = [
  { to: '/venue', icon: LayoutDashboard, label: 'Overview', end: true },
  { to: '/venue/courts', icon: MapPin, label: 'Courts' },
  { to: '/venue/bookings', icon: Calendar, label: 'Bookings' },
  { to: '/venue/events', icon: CalendarDays, label: 'Events' },
  { to: '/venue/settings', icon: Settings, label: 'Settings' },
];

interface VenueTheme {
  primary: string;
  primaryForeground: string;
  secondary: string;
}

function useVenueTheme(): VenueTheme {
  const { currentVenue } = useMode();
  
  return useMemo(() => ({
    primary: currentVenue?.primary_color || '#22c55e', // fallback to default green
    primaryForeground: '#ffffff',
    secondary: currentVenue?.secondary_color || '#1a1a1a',
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

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
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
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm',
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
  const { currentVenue } = useMode();
  const venueTheme = useVenueTheme();
  const location = useLocation();

  // Use centralized branding helper for reliable logo display
  const logoSrc = getVenueLogoSrc(currentVenue?.logo_url, currentVenue?.venue_name);

  // Calculate active tab index for sliding indicator
  const activeIndex = bottomNavItems.findIndex(item => 
    item.end 
      ? location.pathname === item.to
      : location.pathname.startsWith(item.to)
  );

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

          <NavLink to="/venue">
            <img 
              src={logoSrc} 
              alt={currentVenue?.venue_name || "Venue"} 
              className="h-12 w-auto cursor-pointer hover:opacity-90 transition-opacity"
              onError={(e) => {
                e.currentTarget.src = getVenueLogoFallback();
              }}
            />
          </NavLink>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <ModeSwitcher />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 lg:ml-64 pt-16 lg:pt-0 pb-24 lg:pb-0">
        <div className="min-h-screen">
          <Outlet />
        </div>
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
            const isActive = item.end 
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to);
            
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
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

      {/* Desktop Bottom Nav */}
      <nav className="hidden lg:block fixed bottom-0 left-64 right-0 z-50 border-t bg-card/95 backdrop-blur-sm">
        <div className="container mx-auto px-4 relative">
          {/* Sliding active indicator for desktop */}
          <div
            className="absolute top-0 left-1/2 h-[3px] rounded-full transition-transform duration-[240ms] ease-out"
            style={{
              backgroundColor: venueTheme.primary,
              width: '60px',
              marginLeft: '-30px',
              transform: activeIndex >= 0 ? `translateX(${(activeIndex - Math.floor(bottomNavItems.length / 2)) * 120}px)` : 'translateX(0)',
              opacity: activeIndex >= 0 ? 1 : 0,
            }}
          />
          <div className="flex items-center justify-center gap-8 py-3">
            {bottomNavItems.map((item) => {
              const isActive = item.end 
                ? location.pathname === item.to
                : location.pathname.startsWith(item.to);
              
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg',
                    'transition-colors duration-[240ms] ease-out',
                    isActive 
                      ? 'font-medium' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}
                  style={isActive ? { 
                    backgroundColor: `${venueTheme.primary}15`,
                    color: venueTheme.primary 
                  } : undefined}
                >
                  <item.icon 
                    className="h-4 w-4 transition-colors duration-[240ms] ease-out"
                    style={isActive ? { color: venueTheme.primary } : undefined}
                  />
                  <span className="text-sm">{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
}

// Export the hook for use in other venue pages
export { useVenueTheme };
