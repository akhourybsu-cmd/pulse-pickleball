import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { returnContextState } from '@/lib/navigation/returnContext';
import { cn } from '@/lib/utils';

export function LeagueHostLink({ communityId, userId, onHero = false }: {
  communityId: string; userId: string | null; onHero?: boolean;
}) {
  const location = useLocation();
  const host = useQuery({
    queryKey: ['league-host', communityId, userId],
    enabled: !!userId,
    staleTime: 60_000,
    retry: 1,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.from('groups').select('name')
        .eq('id', communityId).abortSignal(signal).maybeSingle();
      if (error) throw error;
      return data?.name ?? null;
    },
  });
  return <Link
    to={`/player/community/group/${encodeURIComponent(communityId)}`}
    state={returnContextState(location, 'League')}
    className={cn('inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-lg text-left text-xs underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary', onHero ? 'text-[#d4d5cf] hover:text-white' : 'text-primary')}
  >
    <span className="min-w-0 break-words">{host.data ? `Hosted by ${host.data}` : 'View host community'}</span>
    <ArrowUpRight aria-hidden className="h-3.5 w-3.5 shrink-0" />
  </Link>;
}
