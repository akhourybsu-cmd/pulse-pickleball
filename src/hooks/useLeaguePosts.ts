import { useEffect } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { leagueProfiles, type LeagueProfile } from '@/lib/leagues/data';

export interface LeaguePost {
  id: string; league_id: string; author_id: string | null; content: string; pinned: boolean;
  version: number; created_at: string; updated_at: string; edited_at: string | null;
  author?: LeagueProfile;
}
export const LEAGUE_POST_LIMIT = 4000;
const PAGE_SIZE = 20;

export function useLeaguePosts(leagueId: string, userId: string | null, active: boolean) {
  const client = useQueryClient();
  const queryKey = ['league-posts', userId, leagueId];
  const query = useInfiniteQuery({
    queryKey, enabled: !!userId && active, initialPageParam: 0, staleTime: 30_000,
    refetchInterval: active ? 60_000 : false,
    queryFn: async ({ pageParam, signal }) => {
      const { data, error } = await supabase.from('league_posts' as never).select('*').eq('league_id', leagueId)
        .order('pinned', { ascending: false }).order('created_at', { ascending: false }).order('id', { ascending: false })
        .range(pageParam, pageParam + PAGE_SIZE - 1).abortSignal(signal);
      if (error) throw error;
      const posts = (data ?? []) as LeaguePost[];
      const profiles = await leagueProfiles(posts.map(post => post.author_id).filter((id): id is string => !!id), signal);
      return posts.map(post => ({ ...post, author: profiles.find(profile => profile.id === post.author_id) }));
    },
    getNextPageParam: (lastPage, pages) => lastPage.length === PAGE_SIZE ? pages.length * PAGE_SIZE : undefined,
  });
  useEffect(() => {
    if (!active || !userId) return;
    const refresh = () => { void client.invalidateQueries({ queryKey: ['league-posts', userId, leagueId] }); };
    const channel = supabase.channel(`league-feed:${leagueId}:${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'league_posts', filter: `league_id=eq.${leagueId}` }, refresh)
      .subscribe();
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('online', refresh);
      document.removeEventListener('visibilitychange', onVisible);
      void supabase.removeChannel(channel);
    };
  }, [active, userId, leagueId, client]);
  const mutation = useMutation({
    mutationFn: async (action:
      | { type: 'create'; id: string; content: string }
      | { type: 'update'; post: LeaguePost; content: string; pinned: boolean }
      | { type: 'delete'; post: LeaguePost }) => {
      const name = action.type === 'create' ? 'create_league_post' : action.type === 'update' ? 'update_league_post' : 'delete_league_post';
      const args = action.type === 'create' ? { p_league_id: leagueId, p_content: action.content.trim(), p_post_id: action.id }
        : { p_post_id: action.post.id, p_expected_version: action.post.version,
          ...(action.type === 'update' ? { p_content: action.content.trim(), p_pinned: action.pinned } : {}) };
      const { data, error } = await supabase.rpc(name as never, args as never);
      if (error) throw error;
      return data;
    },
    onSuccess: () => { void client.invalidateQueries({ queryKey }); },
    onError: () => { void client.invalidateQueries({ queryKey }); },
  });
  // A new post between page requests must not render an older row twice.
  const posts = [...new Map(query.data?.pages.flat().map(post => [post.id, post]) ?? []).values()];
  return { ...query, posts, mutate: mutation.mutateAsync, saving: mutation.isPending };
}
