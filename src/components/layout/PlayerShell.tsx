import { useState, useEffect, useCallback } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Home, Calendar, Users, Search, ClipboardList, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/ThemeToggle';
import { NotificationBell } from '@/components/NotificationBell';
import { UnverifiedMatchesIndicator } from '@/components/UnverifiedMatchesIndicator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import logo from '@/assets/pulse-logo-new.png';

const navItems = [
  { to: '/player/dashboard', icon: Home, label: 'Dashboard' },
  { to: '/player/venues', icon: Search, label: 'Venues' },
  { to: '/player/my-events', icon: Calendar, label: 'Events' },
  { to: '/player/my-bookings', icon: ClipboardList, label: 'Bookings' },
  { to: '/player/community', icon: Users, label: 'Community' },
];

// Prefetch map for route preloading on hover
const prefetchMap: Record<string, () => Promise<unknown>> = {
  '/player/dashboard': () => import('@/pages/player/PlayerDashboard'),
  '/player/venues': () => import('@/pages/player/VenueDiscovery'),
  '/player/my-events': () => import('@/pages/player/MyEvents'),
  '/player/my-bookings': () => import('@/pages/player/MyBookings'),
  '/player/community': () => import('@/pages/player/Community'),
};

export function PlayerShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState<{ id: string; avatarUrl?: string; displayName?: string } | null>(null);
  
  // Hide shell header on dashboard since it has its own ProfileHero header
  const isDashboard = location.pathname === '/player/dashboard';

  // Calculate active tab index for sliding indicator
  const activeIndex = navItems.findIndex(item => 
    location.pathname === item.to || 
    (item.to !== '/player/dashboard' && location.pathname.startsWith(item.to))
  );

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('avatar_url, display_name, full_name')
          .eq('id', session.user.id)
          .single();
        
        setUser({
          id: session.user.id,
          avatarUrl: profile?.avatar_url || undefined,
          displayName: profile?.display_name || profile?.full_name || 'Player'
        });
      }
    };
    fetchUser();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const initials = user?.displayName
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'P';

  // Prefetch route on hover
  const handlePrefetch = useCallback((to: string) => {
    const prefetch = prefetchMap[to];
    if (prefetch) prefetch();
  }, []);
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Header - Hidden on dashboard */}
      {!isDashboard && (
        <header className="sticky top-0 z-50 border-b bg-secondary shadow-sm">
          <div className="w-full max-w-[1280px] mx-auto px-4 lg:px-6 py-4 flex items-center justify-between h-[72px]">
            <NavLink to="/player/dashboard" className="ml-2">
              <img 
                src={logo} 
                alt="PULSE Logo" 
                className="h-[60px] sm:h-[75px] w-auto cursor-pointer hover:opacity-80 transition-opacity" 
              />
            </NavLink>
            <div className="flex items-center gap-2">
              <UnverifiedMatchesIndicator />
              <ThemeToggle />
              <NotificationBell unreadCount={0} onOpen={() => {}} />
              <Avatar 
                className="h-9 w-9 border-2 border-primary/30 cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => user && navigate(`/profile/${user.id}`)}
              >
                <AvatarImage src={user?.avatarUrl} alt={user?.displayName} />
                <AvatarFallback className="text-xs font-bold bg-primary/20 text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSignOut}
                className="text-white hover:text-white/90 hover:bg-white/10 h-[38px] w-[38px]"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </header>
      )}

      {/* Main Content */}
      <main className="flex-1 pb-24 md:pb-20">
        <Outlet />
      </main>

      {/* Bottom Navigation - Mobile Only */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card/95 backdrop-blur-sm md:hidden pb-[env(safe-area-inset-bottom)]">
        {/* Sliding active indicator */}
        <div
          className="absolute top-0 h-[3px] bg-primary rounded-full transition-all duration-[240ms] ease-out"
          style={{
            width: `${100 / navItems.length * 0.6}%`,
            left: `${(100 / navItems.length) * activeIndex + (100 / navItems.length) * 0.2}%`,
          }}
        />
        <div className="flex items-center justify-around py-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.to || 
              (item.to !== '/player/dashboard' && location.pathname.startsWith(item.to));
            
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onMouseEnter={() => handlePrefetch(item.to)}
                className={cn(
                  'flex flex-col items-center gap-1 px-3 py-2 rounded-lg min-w-[60px]',
                  'transition-colors duration-[240ms] ease-out',
                  isActive 
                    ? 'text-primary/80' 
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <item.icon className={cn('h-5 w-5 transition-colors duration-[240ms] ease-out', isActive && 'text-primary/80')} />
                <span className="text-xs font-medium">{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>

      {/* Desktop Horizontal Nav */}
      <nav className="hidden md:block fixed bottom-0 left-0 right-0 z-50 border-t bg-card/95 backdrop-blur-sm">
        <div className="container mx-auto px-4 relative">
          {/* Sliding active indicator for desktop */}
          <div
            className="absolute top-0 left-1/2 h-[3px] bg-primary rounded-full transition-transform duration-[240ms] ease-out"
            style={{
              width: '60px',
              marginLeft: '-30px',
              transform: `translateX(${(activeIndex - Math.floor(navItems.length / 2)) * 120}px)`,
            }}
          />
          <div className="flex items-center justify-center gap-8 py-3">
            {navItems.map((item) => {
              const isActive = location.pathname === item.to || 
                (item.to !== '/player/dashboard' && location.pathname.startsWith(item.to));
              
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onMouseEnter={() => handlePrefetch(item.to)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg',
                    'transition-colors duration-[240ms] ease-out',
                    isActive 
                      ? 'bg-primary/10 text-primary font-medium' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}
                >
                  <item.icon className={cn('h-4 w-4 transition-colors duration-[240ms] ease-out')} />
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
