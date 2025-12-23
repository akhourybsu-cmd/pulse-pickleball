import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { Home, Calendar, MapPin, Search, ClipboardList } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ModeSwitcher } from '@/components/mode/ModeSwitcher';
import logo from '@/assets/pulse-logo-new.png';

const navItems = [
  { to: '/player/dashboard', icon: Home, label: 'Home' },
  { to: '/player/venues', icon: Search, label: 'Venues' },
  { to: '/player/my-events', icon: Calendar, label: 'Events' },
  { to: '/player/my-bookings', icon: ClipboardList, label: 'Bookings' },
  { to: '/player/courts', icon: MapPin, label: 'Courts' },
];

export function PlayerShell() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Header */}
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <NavLink to="/player/dashboard">
            <img 
              src={logo} 
              alt="PULSE Logo" 
              className="h-10 sm:h-12 w-auto cursor-pointer hover:opacity-80 transition-opacity logo-pulse" 
            />
          </NavLink>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <ModeSwitcher />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 pb-20 md:pb-6">
        <Outlet />
      </main>

      {/* Bottom Navigation - Mobile Only */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card/95 backdrop-blur-sm md:hidden">
        <div className="flex items-center justify-around py-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.to || 
              (item.to !== '/player/dashboard' && location.pathname.startsWith(item.to));
            
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={cn(
                  'flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[60px]',
                  isActive 
                    ? 'text-primary' 
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <item.icon className={cn('h-5 w-5', isActive && 'text-primary')} />
                <span className="text-xs font-medium">{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>

      {/* Desktop Horizontal Nav */}
      <nav className="hidden md:block fixed bottom-0 left-0 right-0 z-50 border-t bg-card/95 backdrop-blur-sm">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center gap-8 py-3">
            {navItems.map((item) => {
              const isActive = location.pathname === item.to || 
                (item.to !== '/player/dashboard' && location.pathname.startsWith(item.to));
              
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors',
                    isActive 
                      ? 'bg-primary/10 text-primary font-medium' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}
                >
                  <item.icon className="h-4 w-4" />
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
