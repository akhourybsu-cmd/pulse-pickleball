import { lazy, useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuthState } from '@/hooks/useAuthState';
import { AuthGuard } from '@/components/guards/AuthGuard';
import { Button } from '@/components/ui/button';
import { clearPostAuthRedirect, stashPostAuthRedirect } from '@/lib/authRedirect';
import { communityAuthUrl } from '@/lib/communityAccess';

const PlayerAppShell = lazy(() => import('@/components/layout/PlayerAppShell'));
const Community = lazy(() => import('@/pages/player/Community'));
const GroupRoute = lazy(() => import('@/pages/player/GroupRoute'));
const PublicCommunity = lazy(() => import('./PublicCommunity'));
const PublicCommunities = lazy(() => import('./PublicCommunities'));

export default function PublicCommunityLayout() {
  const { isAuthenticated, loading } = useAuthState();
  const location = useLocation();
  const target = `${location.pathname}${location.search}${location.hash}`;
  useEffect(() => {
    if (isAuthenticated) clearPostAuthRedirect(target);
  }, [isAuthenticated, target]);
  if (loading) return <div role="status" className="p-8 text-center">Opening your community…</div>;
  if (isAuthenticated) return <AuthGuard><PlayerAppShell /></AuthGuard>;
  return <div className="min-h-screen bg-background text-foreground">
    <header className="border-b bg-background px-4 py-3 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
        <Link to="/" className="text-xl font-black tracking-widest" aria-label="PULSE home">PULSE<span className="text-primary">.</span></Link>
        <nav className="flex items-center gap-3 text-sm" aria-label="Guest navigation">
          <Link to="/player/community" className="py-3 hover:underline">Explore</Link>
          <Button asChild variant="outline" className="min-h-11"><Link to={communityAuthUrl(target, 'signin')} onClick={() => stashPostAuthRedirect(target)}>Sign in</Link></Button>
        </nav>
      </div>
    </header>
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8"><Outlet /></main>
    <footer className="px-4 py-8 text-center text-xs text-muted-foreground">Your next game starts with community. Powered by PULSE.</footer>
  </div>;
}

export function CommunityDirectoryRoute() {
  const { isAuthenticated } = useAuthState();
  return isAuthenticated ? <Community /> : <PublicCommunities />;
}

export function CommunityDetailRoute() {
  const { isAuthenticated } = useAuthState();
  return isAuthenticated ? <GroupRoute /> : <PublicCommunity />;
}
