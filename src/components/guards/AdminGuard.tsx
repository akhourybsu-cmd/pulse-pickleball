import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthState } from '@/hooks/useAuthState';
import { Button } from '@/components/ui/button';

/** UI gate only. The database pins the admin role and independently authorizes every control-plane RPC. */
export function AdminGuard({ children, fallbackPath = '/player/dashboard' }: { children: ReactNode; fallbackPath?: string }) {
  const { loading: authLoading, isAuthenticated, user } = useAuthState();
  const location = useLocation();
  const access = useQuery({
    queryKey: ['platform-admin-access', user?.id],
    enabled: !authLoading && isAuthenticated && !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from('user_roles').select('role').eq('user_id', user!.id).eq('role', 'admin').maybeSingle();
      if (error) throw error; return !!data;
    },
    staleTime: 0, gcTime: 0, retry: 1,
  });
  if (!authLoading && !isAuthenticated) return <Navigate to="/auth" state={{ from: location }} replace />;
  if (authLoading || access.isPending) return <div className="flex min-h-dvh items-center justify-center p-6"><p role="status" className="text-sm text-muted-foreground">Checking platform access…</p></div>;
  if (access.isError) return <div className="mx-auto max-w-md space-y-4 p-6" role="alert"><p>Platform access couldn’t be verified. No admin content has been loaded.</p><Button onClick={() => void access.refetch()}>Retry access check</Button></div>;
  if (!access.data) return <Navigate to={fallbackPath} replace />;
  return <>{children}</>;
}
