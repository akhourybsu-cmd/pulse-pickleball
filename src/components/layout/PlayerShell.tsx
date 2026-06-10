import { useState, useEffect, useCallback } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Home, Trophy, Compass, User, LogOut, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/ThemeToggle';
import { NotificationBell } from '@/components/NotificationBell';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { useNotifications } from '@/hooks/useNotifications';
import { UnverifiedMatchesIndicator } from '@/components/UnverifiedMatchesIndicator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import logo from '@/assets/pulse-logo-new.png';
import { VenueModeBanner } from '@/components/mode/VenueModeBanner';

// Player-first bottom nav. The previous "Venues" tab was removed as part of
// the player/venue separation — venue discovery lives behind the mode toggle
// (RoleSwitcherCard on the dashboard, ModeSwitcher in the page header for
// dual-role users), not as a primary player navigation destination.
const navItems = [
  { to: '/player/dashboard', icon: Home, label: 'Home' },
  { to: '/player/matches', icon: Trophy, label: 'Matches' },
  { to: '/player/play', icon: Compass, label: 'Play' },
  { to: '/player/profile', icon: User, label: 'Profile' },
];

// Prefetch map for route preloading on hover
const prefetchMap: Record<string, () => Promise<unknown>> = {
  '/player/dashboard': () => import('@/pages/player/PlayerDashboard'),
  '/player/matches': () => import('@/pages/MatchHistory'),
  '/player/play': () => import('@/pages/play/PlayHub'),
  '/player/profile': () => import('@/pages/player/PlayerProfile'),
};

export function PlayerShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState<{ id: string; avatarUrl?: string; displayName?: string } | null>(null);
  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState(false);
  
  // Real-time notifications
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
    groupedByTime,
  } = useNotifications(user?.id);
  
  // Full-screen immersive routes (hide all shell chrome).
  // Match entry has its own sticky header + fixed bottom CTA bar; rendering
  // PlayerShell's bottom nav alongside it would stack two fixed bars on top
  // of each other.
  const isImmersiveRoute =
    location.pathname.includes('/player/community/group/') ||
    location.pathname.includes('/player/messages/') ||
    location.pathname === '/player/matches/new';

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
      {/* Top Header — single source of top chrome across all player tabs.
          Previously hidden on /player/dashboard which rendered its own ProfileHero
          nav strip; that's been removed so this header now owns the top on every
          non-immersive player route. */}
      {!isImmersiveRoute && (
        <header className="sticky top-0 z-50 border-b border-secondary-foreground/10 bg-secondary shadow-sm">
          <div className="w-full max-w-[1280px] mx-auto px-4 lg:px-6 py-3 flex items-center justify-between h-[64px] sm:h-[72px]">
            <NavLink to="/player/dashboard" className="ml-1">
              <img 
                src={logo} 
                alt="PULSE Logo" 
                className="h-[52px] sm:h-[65px] w-auto cursor-pointer hover:opacity-90 transition-opacity" 
              />
            </NavLink>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <UnverifiedMatchesIndicator />
              <ThemeToggle />
              <NotificationBell unreadCount={unreadCount} onOpen={() => setIsNotificationCenterOpen(true)} />
              <Avatar 
                className="h-8 w-8 sm:h-9 sm:w-9 border-2 border-primary/40 cursor-pointer hover:border-primary/60 transition-all hover:scale-105"
                onClick={() => user && navigate(`/profile/${user.id}`)}
              >
                <AvatarImage src={user?.avatarUrl} alt={user?.displayName} />
                <AvatarFallback className="text-[10px] sm:text-xs font-bold bg-primary/20 text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSignOut}
                className="text-secondary-foreground/80 hover:text-secondary-foreground hover:bg-secondary-foreground/10 h-8 w-8 sm:h-9 sm:w-9"
              >
                <LogOut className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            </div>
          </div>
        </header>
      )}

      {/* Notification Center */}
      <NotificationCenter
        isOpen={isNotificationCenterOpen}
        onClose={() => setIsNotificationCenterOpen(false)}
        notifications={notifications}
        unreadCount={unreadCount}
        onMarkAsRead={markAsRead}
        onMarkAllAsRead={markAllAsRead}
        onDelete={deleteNotification}
        onClearAll={clearAll}
        groupedByTime={groupedByTime}
      />

      {/* Venue Mode Banner - shows when in venue mode on player routes */}
      <VenueModeBanner />

      {/* Main Content */}
      <main className={isImmersiveRoute ? "flex-1" : "flex-1 pb-24 md:pb-20"}>
        <Outlet />
      </main>

      {/* Record Match FAB — hidden on immersive routes and on the match entry page itself */}
      {!isImmersiveRoute && !location.pathname.startsWith('/match/new') && !location.pathname.startsWith('/player/matches/new') && (
        <button
          onClick={() => navigate('/player/matches/new')}
          aria-label="Record a match"
          className={cn(
            'fixed right-4 z-40 flex items-center gap-2 rounded-full bg-primary text-primary-foreground shadow-lg',
            'h-14 pl-5 pr-6 font-semibold text-sm',
            'hover:bg-primary/90 active:scale-95 transition-all',
            'bottom-[88px] md:bottom-[72px] pb-[env(safe-area-inset-bottom)]'
          )}
        >
          <Plus className="h-5 w-5" strokeWidth={2.5} />
          <span>Record Match</span>
        </button>
      )}

      {/* Bottom Navigation - Mobile Only - Premium Polish */}
      {!isImmersiveRoute && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/40 bg-card/98 backdrop-blur-md md:hidden pb-[env(safe-area-inset-bottom)]">
          {/* Sliding active indicator - refined */}
          <div
            className="absolute top-0 h-[2.5px] bg-primary rounded-full transition-all duration-[240ms] ease-out"
            style={{
              width: `${100 / navItems.length * 0.5}%`,
              left: `${(100 / navItems.length) * activeIndex + (100 / navItems.length) * 0.25}%`,
            }}
          />
          <div className="flex items-center justify-around py-2.5">
            {navItems.map((item) => {
              const isActive = location.pathname === item.to || 
                (item.to !== '/player/dashboard' && location.pathname.startsWith(item.to));
              
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onMouseEnter={() => handlePrefetch(item.to)}
                  className={cn(
                    'flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg min-w-[56px]',
                    'transition-all duration-[240ms] ease-out',
                    isActive 
                      ? 'text-primary' 
                      : 'text-muted-foreground/70 hover:text-foreground active:scale-95'
                  )}
                >
                  <item.icon className={cn(
                    'h-[22px] w-[22px] transition-all duration-[240ms] ease-out',
                    isActive ? 'text-primary' : 'stroke-[1.5]'
                  )} />
                  <span className={cn(
                    'nav-label',
                    isActive ? 'text-primary font-semibold' : 'font-medium'
                  )}>{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        </nav>
      )}

      {/* Desktop Horizontal Nav - Premium Polish */}
      {!isImmersiveRoute && (
        <nav className="hidden md:block fixed bottom-0 left-0 right-0 z-50 border-t border-border/40 bg-card/98 backdrop-blur-md">
          <div className="container mx-auto px-4 relative">
            {/* Sliding active indicator for desktop - refined */}
            <div
              className="absolute top-0 left-1/2 h-[2.5px] bg-primary rounded-full transition-transform duration-[240ms] ease-out"
              style={{
                width: '48px',
                marginLeft: '-24px',
                transform: `translateX(${(activeIndex - Math.floor(navItems.length / 2)) * 116}px)`,
              }}
            />
            <div className="flex items-center justify-center gap-6 py-2.5">
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
                      'transition-all duration-[200ms] ease-out',
                      isActive 
                        ? 'bg-primary/10 text-primary' 
                        : 'text-muted-foreground/70 hover:text-foreground hover:bg-muted/50'
                    )}
                  >
                    <item.icon className={cn(
                      'h-4 w-4 transition-all duration-[200ms] ease-out',
                      !isActive && 'stroke-[1.5]'
                    )} />
                    <span className={cn(
                      'text-sm nav-label',
                      isActive ? 'font-semibold' : 'font-medium'
                    )}>{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          </div>
        </nav>
      )}
    </div>
  );
}
