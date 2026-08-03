import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Home, Trophy, Users, User, Plus, MessageSquare, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/ThemeToggle';
import { NotificationBell } from '@/components/NotificationBell';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { useNotifications } from '@/hooks/useNotifications';
import { useDirectMessages } from '@/hooks/useDirectMessages';
import { ShellContentTransition } from '@/components/layout/ShellContentTransition';
import { PRIMARY_TABS, primaryTabIndex } from '@/lib/navigation/primaryTabs';
import { routeAnnouncement } from '@/lib/navigation/navClassification';
import { Skeleton } from '@/components/ui/skeleton';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { Logo } from '@/components/Logo';
import { FriendsPresenceProvider } from '@/contexts/FriendsPresenceContext';
// VenueModeBanner removed during the player-only beta. Component file
// stays put for easy revival when the venue surface is re-enabled.

// Player-first bottom nav. Tab ORDER + labels come from the single
// authoritative definition (src/lib/navigation/primaryTabs) so the nav and
// the horizontal page transition can never disagree about which tab is where.
// Only the icon (a pure view concern) is mapped locally.
const TAB_ICONS: Record<string, typeof Home> = {
  '/player/dashboard': Home,
  '/player/matches': Trophy,
  '/player/social': MessageCircle,
  '/player/community': Users,
  '/player/profile': User,
};
const navItems = PRIMARY_TABS.map((t) => ({
  to: t.path,
  label: t.label,
  icon: TAB_ICONS[t.path] ?? Home,
}));

// Prefetch map for route preloading (hover on desktop, idle on mobile).
const prefetchMap: Record<string, () => Promise<unknown>> = {
  '/player/dashboard': () => import('@/pages/player/PlayerDashboard'),
  '/player/matches': () => import('@/pages/MatchHistory'),
  '/player/social': () => import('@/pages/player/Social'),
  '/player/community': () => import('@/pages/player/Community'),
  '/player/profile': () => import('@/pages/player/PlayerProfile'),
};

/** In-frame skeleton shown only if a tab's code chunk is still loading —
 *  keeps the header + bottom nav mounted instead of flashing a full-screen
 *  loader (which would blank the whole shell). */
function TabContentFallback() {
  return (
    <div className="container mx-auto px-4 py-6 max-w-3xl space-y-4" aria-hidden>
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-24 w-full rounded-2xl" />
      <Skeleton className="h-24 w-full rounded-2xl" />
      <Skeleton className="h-24 w-full rounded-2xl" />
    </div>
  );
}

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

  // Active tab index for the sliding indicator + per-item active state —
  // from the shared definition, so the highlight, the indicator, and the
  // slide direction all agree (incl. the Social→friends/messages aliases).
  const activeIndex = primaryTabIndex(location.pathname);

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

  // Move focus into the fresh content region after each navigation so screen
  // reader + keyboard users follow the route change. Skipped on first render
  // (deep link) and when the destination has already claimed focus (e.g. a
  // page that autofocuses a field), so we never steal an intentional focus.
  const mainRef = useRef<HTMLElement>(null);
  const firstFocusRef = useRef(true);
  useEffect(() => {
    if (firstFocusRef.current) {
      firstFocusRef.current = false;
      return;
    }
    const active = document.activeElement;
    if (active && active !== document.body && mainRef.current?.contains(active)) return;
    mainRef.current?.focus({ preventScroll: true });
  }, [location.pathname]);

  // Warm every primary tab's code chunk once, at idle, so tapping a tab on
  // mobile (no hover to trigger prefetch) can animate immediately instead of
  // suspending on a cold chunk. Bounded to the five known tabs; failures are
  // ignored (the route will still lazy-load normally).
  useEffect(() => {
    const warm = () => Object.values(prefetchMap).forEach((fn) => fn().catch(() => {}));
    const w = window as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (h: number) => void;
    };
    if (typeof w.requestIdleCallback === 'function') {
      const handle = w.requestIdleCallback(warm, { timeout: 2500 });
      return () => w.cancelIdleCallback?.(handle);
    }
    const t = setTimeout(warm, 600);
    return () => clearTimeout(t);
  }, []);

  return (
    <FriendsPresenceProvider>
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Header — single source of top chrome across all player tabs.
          Previously hidden on /player/dashboard which rendered its own ProfileHero
          nav strip; that's been removed so this header now owns the top on every
          non-immersive player route. */}
      {!isImmersiveRoute && (
        <header className="sticky top-0 z-50 border-b border-secondary-foreground/10 bg-secondary shadow-sm pt-[env(safe-area-inset-top)]">
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

      {/* Main Content — the ONLY region that moves during a tab change. The
          header (above) and bottom nav (below) are siblings, so they stay
          visually fixed. An inner Suspense keeps them mounted if a tab's
          chunk is still loading, instead of blanking the shell. Programmatic
          focus lands here after each navigation (see effect above), moving
          screen-reader + keyboard focus into the fresh content. */}
      <main
        ref={mainRef}
        tabIndex={-1}
        className={cn("focus:outline-none", isImmersiveRoute ? "flex-1" : "flex-1 pb-24 md:pb-20")}
      >
        <Suspense fallback={<TabContentFallback />}>
          <ShellContentTransition immersive={isImmersiveRoute} />
        </Suspense>
      </main>

      {/* Restrained screen-reader route announcement (known pages only). */}
      <RouteAnnouncer />

      {/* Record Match FAB — only surfaced on the player tabs where logging
          a match is a natural next action: the Home dashboard, the Matches
          history list, and the Play hub. Hidden on Profile (settings-y),
          the match entry page itself (would loop), and immersive routes
          (community groups, DMs) where the FAB would clash with their own
          fixed bottom chrome. */}
      {(() => {
        // NOTE: Home (/player/dashboard) is intentionally excluded — its
        // QuickActionsBar already has a prominent "Record Match" card, so the
        // FAB there was redundant and overlapped the content.
        const recordMatchRoutes = [
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
            {navItems.map((item, index) => {
              const isActive = activeIndex === index;

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
                  <span className="relative">
                    <item.icon className={cn(
                      'h-[22px] w-[22px] transition-all duration-[240ms] ease-out',
                      isActive ? 'text-primary' : 'stroke-[1.5]'
                    )} />
                    {item.to === '/player/social' && dmUnread > 0 && (
                      <span className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center tabular-nums">
                        {dmUnread > 9 ? '9+' : dmUnread}
                      </span>
                    )}
                  </span>
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
              {navItems.map((item, index) => {
                const isActive = activeIndex === index;

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
                    <span className="relative">
                      <item.icon className={cn(
                        'h-4 w-4 transition-all duration-[200ms] ease-out',
                        !isActive && 'stroke-[1.5]'
                      )} />
                      {item.to === '/player/social' && dmUnread > 0 && (
                        <span className="absolute -top-1.5 -right-2 min-w-[15px] h-[15px] px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center tabular-nums">
                          {dmUnread > 9 ? '9+' : dmUnread}
                        </span>
                      )}
                    </span>
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
    </FriendsPresenceProvider>
  );
}

/**
 * Visually-hidden polite live region that announces meaningful route changes
 * (the five tabs + a short list of known detail pages). It skips the first
 * render (deep link / refresh) and only updates on pathname changes, so query
 * or loading-state updates are never announced. Rendered once in the shell so
 * the live region itself is never remounted.
 */
function RouteAnnouncer() {
  const { pathname } = useLocation();
  const [message, setMessage] = useState('');
  const firstRef = useRef(true);
  useEffect(() => {
    if (firstRef.current) {
      firstRef.current = false;
      return;
    }
    setMessage(routeAnnouncement(pathname) ?? '');
  }, [pathname]);
  return (
    <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {message}
    </div>
  );
}
