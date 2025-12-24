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
  BarChart3
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ModeSwitcher } from '@/components/mode/ModeSwitcher';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useState, useMemo, CSSProperties } from 'react';
import pickleballPalaceLogo from '@/assets/pickleball-palace-logo.png';
import { useMode } from '@/contexts/ModeContext';

const navItems = [
  { to: '/venue', icon: LayoutDashboard, label: 'Overview', end: true },
  { to: '/venue/courts', icon: MapPin, label: 'Courts' },
  { to: '/venue/bookings', icon: Calendar, label: 'Bookings' },
  { to: '/venue/events', icon: CalendarDays, label: 'Events' },
  { to: '/venue/coaching', icon: GraduationCap, label: 'Coaching' },
  { to: '/venue/staff', icon: Users, label: 'Staff' },
  { to: '/venue/analytics', icon: BarChart3, label: 'Analytics' },
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

  // Use dynamic logo from venue record, fallback to Pickleball Palace logo
  const logoSrc = currentVenue?.logo_url || pickleballPalaceLogo;

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div 
        className="p-4 border-b"
        style={{ 
          borderBottomColor: `${venueTheme.primary}30` 
        }}
      >
        <NavLink to="/venue" onClick={onItemClick}>
          <img 
            src={logoSrc} 
            alt={currentVenue?.venue_name || "Venue"} 
            className="h-12 w-auto cursor-pointer hover:opacity-80 transition-opacity" 
          />
        </NavLink>
        {currentVenue && (
          <div className="mt-3 px-1">
            <p className="text-sm font-medium text-foreground truncate">{currentVenue.venue_name}</p>
            <p 
              className="text-xs capitalize"
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

  // Use dynamic logo from venue record, fallback to Pickleball Palace logo
  const logoSrc = currentVenue?.logo_url || pickleballPalaceLogo;

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 border-r bg-sidebar flex-col fixed h-screen">
        <SidebarContent />
      </aside>

      {/* Mobile Header + Sheet */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 border-b bg-card/95 backdrop-blur-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
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
              className="h-10 w-auto cursor-pointer hover:opacity-80 transition-opacity" 
            />
          </NavLink>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <ModeSwitcher />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 lg:ml-64 pt-16 lg:pt-0">
        <div className="min-h-screen">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

// Export the hook for use in other venue pages
export { useVenueTheme };
