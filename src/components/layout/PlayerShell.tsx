import { useState, useEffect, useCallback } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Home, Trophy, Users, User, Plus, MessageSquare } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/ThemeToggle';
import { NotificationBell } from '@/components/NotificationBell';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { useNotifications } from '@/hooks/useNotifications';
import { useDirectMessages } from '@/hooks/useDirectMessages';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { Logo } from '@/components/Logo';
// VenueModeBanner removed during the player-only beta. Component file
// stays put for easy revival when the venue surface is re-enabled.

// Player-first bottom nav. The previous "Venues" tab was removed as part of
// the player/venue separation — venue discovery lives behind the mode toggle
// (RoleSwitcherCard on the dashboard, ModeSwitcher in the page header for
// dual-role users), not as a primary player navigation destination.
const navItems = [
  { to: '/player/dashboard', icon: Home, label: 'Home' },
  { to: '/player/matches', icon: Trophy, label: 'Matches' },
  { to: '/player/community', icon: Users, label: 'Community' },
  { to: '/player/profile', icon: User, label: 'Profile' },
];

// Prefetch map for route preloading on hover
const prefetchMap: Record<string, () => Promise<unknown>> = {
  '/player/dashboard': () => import('@/pages/player/PlayerDashboard'),
  '/player/matches': () => import('@/pages/MatchHistory'),
  '/player/community': () => import('@/pages/player/Community'),
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
    loading: notificationsLoading,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
    groupedByTime,
  } = useNotifications(user?.id);

  // Surfacing total unread DM count in the header so Messages is one
  // tap from anywhere instead of being buried 2-3 levels deep behind
  // the Community tab.
  const { totalUnread: dmUnread } = useDirectMessages();

  // Full-screen immersive routes (hide all shell chrome).
  // Match entry has its own sticky header + fixed bottom CTA bar; rendering
  // PlayerShell's bottom nav alongside it would stack two fixed bars on top
  // of each other.
  const isImmersiveRoute =
    location.pathname.includes('/player/community/group/') ||
    location.pathname.includes('/player/messages/') ||
    location.pathname === '/player/matches/new';

  // Calculate active tab index for sliding indicator
  const activeIndex = navItems.findIndex(item => {
    if (item.to === '/player/community') {
      return location.pathname.startsWith('/player/community') ||
        location.pathname.startsWith('/player/friends');
    }
    return location.pathname === item.to ||
      (item.to !== '/player/dashboard' && location.pathname.startsWith(item.to));
  });

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

  // Sign-out moved to PlayerProfile (Phase 5) — no longer surfaced from
  // the shell's top header. One source of truth.

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

  // ---- Page-transition wiring ---------------------------------------
  // A gentle enter animation as content swaps between routes. The header,
  // FAB, and bottom nav live OUTSIDE the animated wrapper below, so they
  // stay perfectly stable while only the page body fades in.
  const reduceMotion = useReducedMotion();
  const isCommunityRoute = location.pathname.startsWith('/player/community');
  // The Community subtree owns its own directional slide
  // (CommunityTransitionOutlet). Give it ONE constant key so this wrapper
  // never remounts as you move list ↔ group ↔ manage — otherwise the two
  // systems would fight. It still fades once when you enter/leave the
  // subtree. Every other route keys by pathname so each navigation replays
  // the enter animation.
  const contentTransitionKey = isCommunityRoute ? 'community-subtree' : location.pathname;
  // Immersive pages (match wizard, DM chat) carry their own fixed bottom
  // bars. A transform on an ancestor re-anchors position:fixed children, so
  // those get an opacity-only fade — standard pages (no fixed descendants)
  // get the slightly richer opacity + lift.
  const enterInitial = isImmersiveRoute ? { opacity: 0 } : { opacity: 0, y: 8 };
  const enterAnimate = isImmersiveRoute ? { opacity: 1 } : { opacity: 1, y: 0 };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Header — single source of top chrome across all player tabs.
          Previously hidden on /player/dashboard which rendered its own ProfileHero
          nav strip; that's been removed so this header now owns the top on every
          non-immersive player route. */}
      {!isImmersiveRoute && (
        <header className="sticky top-0 z-50 border-b border-secondary-foreground/10 bg-secondary shadow-sm">
          <div className="w-full max-w-[1280px] mx-auto px-4 lg:px-6 py-3 flex items-center justify-between h-[64px] sm:h-[72px]">
            {/* Logo now inherits color from text-secondary-foreground (cream)
                so the wordmark + flat lines render cream on the ink top bar
                instead of a pasted cream rectangle. Gold pulse beat stays
                gold for brand recognition. */}
            <NavLink
              to="/player/dashboard"
              className="ml-1 text-secondary-foreground hover:opacity-90 transition-opacity"
              aria-label="Go to dashboard"
            >
              <Logo className="h-[52px] sm:h-[65px] w-auto" />
            </NavLink>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <ThemeToggle />
              {/* Messages — one-tap entry to /player/messages from any
                  page. Pre-add this was 2-3 taps deep behind Community.
                  Unread count mirrors useDirectMessages.totalUnread. */}
              <button
                type="button"
                onClick={() => navigate('/player/messages')}
                aria-label={dmUnread > 0 ? `Messages, ${dmUnread} unread` : 'Messages'}
                className="relative inline-flex items-center justify-center h-8 w-8 sm:h-9 sm:w-9 rounded-full text-secondary-foreground hover:bg-secondary-foreground/10 transition-colors"
              >
                <MessageSquare className="h-[18px] w-[18px] sm:h-5 sm:w-5" />
                {dmUnread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center tabular-nums">
                    {dmUnread > 99 ? '99+' : dmUnread}
                  </span>
                )}
              </button>
              <NotificationBell unreadCount={unreadCount} onOpen={() => setIsNotificationCenterOpen(true)} />
              {/* Avatar → Profile tab (was the public /profile/:id view,
                  which surprised users expecting to land in their own hub). */}
              <Avatar
                className="h-8 w-8 sm:h-9 sm:w-9 border-2 border-primary/40 cursor-pointer hover:border-primary/60 transition-all hover:scale-105"
                onClick={() => navigate('/player/profile')}
              >
                <AvatarImage src={user?.avatarUrl} alt={user?.displayName} />
                <AvatarFallback className="text-[10px] sm:text-xs font-bold bg-primary/20 text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        </header>
      )}

      {/* Notification Center */}
      <NotificationCenter
        isOpen={isNotificationCenterOpen}
        onClose={() => setIsNotificationCenterOpen(false)}
        notifications={notifications}
        loading={notificationsLoading}
        unreadCount={unreadCount}
        onMarkAsRead={markAsRead}
        onMarkAllAsRead={markAllAsRead}
        onDelete={deleteNotification}
        onClearAll={clearAll}
        groupedByTime={groupedByTime}
      />

      {/* Main Content */}
      <main className={isImmersiveRoute ? "flex-1" : "flex-1 pb-24 md:pb-20"}>
        {reduceMotion ? (
          <Outlet />
        ) : (
          <motion.div
            key={contentTransitionKey}
            initial={enterInitial}
            animate={enterAnimate}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            <Outlet />
          </motion.div>
        )}
      </main>

      {/* Record Match FAB — only surfaced on the player tabs where logging
          a match is a natural next action: the Home dashboard, the Matches
          history list, and the Play hub. Hidden on Profile (settings-y),
          the match entry page itself (would loop), and immersive routes
          (community groups, DMs) where the FAB would clash with their own
          fixed bottom chrome. */}
      {(() => {
        const recordMatchRoutes = [
          '/player/dashboard',
          '/player/matches',
          '/player/play',
        ];
        const showFab =
          !isImmersiveRoute &&
          recordMatchRoutes.some(
            (r) => location.pathname === r || location.pathname.startsWith(`${r}/`)
          ) &&
          !location.pathname.startsWith('/player/matches/new');
        if (!showFab) return null;
        return (
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
        );
      })()}

      {/* Bottom Navigation - Mobile Only - Premium Polish */}
      {!isImmersiveRoute && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/40 bg-card md:hidden pb-[env(safe-area-inset-bottom)]">
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
        <nav className="hidden md:block fixed bottom-0 left-0 right-0 z-50 border-t border-border/40 bg-card">
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
