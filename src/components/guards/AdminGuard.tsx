import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuthState } from '@/hooks/useAuthState';
import { Skeleton } from '@/components/ui/skeleton';

interface AdminGuardProps {
  children: React.ReactNode;
  fallbackPath?: string;
}

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-background">
    <div className="space-y-4 w-full max-w-md p-8">
      <Skeleton className="h-8 w-3/4 mx-auto" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-32 w-full" />
    </div>
  </div>
);

/**
 * AdminGuard protects platform-admin routes at the router level.
 * Checks user_roles.role = 'admin' before rendering children — prevents
 * the FOUC (flash of unauthorized content) that page-level checks cause.
 */
export function AdminGuard({
  children,
  fallbackPath = '/app/home',
}: AdminGuardProps) {
  const { loading: authLoading, isAuthenticated, user } = useAuthState();
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      if (!user?.id) {
        if (!cancelled) {
          setIsAdmin(false);
          setChecking(false);
        }
        return;
      }

      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (!cancelled) {
        setIsAdmin(!!data);
        setChecking(false);
      }
    };

    if (!authLoading) {
      check();
    }

    return () => {
      cancelled = true;
    };
  }, [user?.id, authLoading]);

  if (authLoading || checking) {
    return <PageLoader />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (!isAdmin) {
    return <Navigate to={fallbackPath} replace />;
  }

  return <>{children}</>;
}
