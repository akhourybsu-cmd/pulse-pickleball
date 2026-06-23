import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface PostComment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  parent_comment_id: string | null;
  created_at: string;
  updated_at: string;
  profile?: {
    id: string;
    display_name: string | null;
    full_name: string;
    avatar_url: string | null;
  };
  replies?: PostComment[];
}

/**
 * Returns a flat list of top-level comments, each with `replies` populated.
 * Realtime updates are handled centrally by `useGroupRealtime` against the
 * `['post-comments', postId]` key.
 */
async function fetchComments(postId: string): Promise<PostComment[]> {
  const { data: commentsData, error } = await supabase
    .from('group_post_comments')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  const userIds = [...new Set((commentsData || []).map((c) => c.user_id))];
  const { data: profilesData } = userIds.length
    ? await supabase
        .from('profiles_public')
        .select('id, display_name, full_name, avatar_url')
        .in('id', userIds)
    : { data: [] as any[] };

  const profilesMap = new Map((profilesData || []).map((p) => [p.id, p]));

  const enriched = (commentsData || []).map((c) => ({
    ...c,
    profile: profilesMap.get(c.user_id),
    replies: [] as PostComment[],
  }));

  const topLevel: PostComment[] = [];
  const repliesMap = new Map<string, PostComment[]>();
  enriched.forEach((c) => {
    if (c.parent_comment_id) {
      const arr = repliesMap.get(c.parent_comment_id) || [];
      arr.push(c);
      repliesMap.set(c.parent_comment_id, arr);
    } else {
      topLevel.push(c);
    }
  });
  topLevel.forEach((c) => {
    c.replies = repliesMap.get(c.id) || [];
  });
  return topLevel;
}

export function useGroupPostComments(postId: string | undefined) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const queryKey = ['post-comments', postId];

  const { data: comments = [], isLoading: loading, refetch } = useQuery({
    queryKey,
    queryFn: () => fetchComments(postId!),
    enabled: !!postId,
    staleTime: Infinity,
    gcTime: 5 * 60 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: async (input: { content: string; parentCommentId?: string; clientId: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('group_post_comments')
        .insert({
          post_id: postId,
          user_id: user.id,
          content: input.content.trim(),
          parent_comment_id: input.parentCommentId || null,
        })
        .select()
        .single();
      if (error) throw error;
      return { row: data, clientId: input.clientId };
    },
    onMutate: async ({ content, parentCommentId, clientId }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Resolve the author profile so optimistic comments never render as
      // "Unknown". Try the cache first (previous comments by this user in
      // this thread), then fall back to a one-shot lookup against
      // profiles_public so first-time commenters still get a name + avatar.
      let cachedAuthor = (queryClient.getQueryData<PostComment[]>(queryKey) || [])
        .flatMap((c) => [c, ...(c.replies || [])])
        .find((c) => c.user_id === user.id)?.profile;

      if (!cachedAuthor) {
        cachedAuthor = queryClient.getQueryData<PostComment['profile']>([
          'comment-author-profile',
          user.id,
        ]);
      }

      if (!cachedAuthor) {
        const { data: profile } = await supabase
          .from('profiles_public')
          .select('id, display_name, full_name, avatar_url')
          .eq('id', user.id)
          .maybeSingle();
        if (profile) {
          cachedAuthor = profile as PostComment['profile'];
          queryClient.setQueryData(['comment-author-profile', user.id], cachedAuthor);
        }
      }

      const now = new Date().toISOString();
      const optimistic: PostComment = {
        id: `temp-${clientId}`,
        post_id: postId!,
        user_id: user.id,
        content: content.trim(),
        parent_comment_id: parentCommentId || null,
        created_at: now,
        updated_at: now,
        profile: cachedAuthor,
        replies: [],
      };
      queryClient.setQueryData<PostComment[]>(queryKey, (prev = []) => {
        if (parentCommentId) {
          return prev.map((c) =>
            c.id === parentCommentId ? { ...c, replies: [...(c.replies || []), optimistic] } : c,
          );
        }
        return [...prev, optimistic];
      });
      // Optimistically bump the parent post's comment_count
      const postsQueries = queryClient.getQueriesData<any[]>({ queryKey: ['group-posts'] });
      postsQueries.forEach(([key, data]) => {
        if (!Array.isArray(data)) return;
        queryClient.setQueryData(key, data.map((p: any) =>
          p.id === postId ? { ...p, comment_count: (p.comment_count || 0) + 1 } : p,
        ));
      });
    },
    onSuccess: ({ row, clientId }) => {
      queryClient.setQueryData<PostComment[]>(queryKey, (prev = []) => {
        const swap = (c: PostComment): PostComment =>
          c.id === `temp-${clientId}` ? { ...c, ...row } : c;
        return prev.map((c) => ({
          ...swap(c),
          replies: (c.replies || []).map(swap),
        }));
      });
    },
    onError: (error: any, { clientId }) => {
      queryClient.setQueryData<PostComment[]>(queryKey, (prev = []) =>
        prev
          .filter((c) => c.id !== `temp-${clientId}`)
          .map((c) => ({ ...c, replies: (c.replies || []).filter((r) => r.id !== `temp-${clientId}`) })),
      );
      const postsQueries = queryClient.getQueriesData<any[]>({ queryKey: ['group-posts'] });
      postsQueries.forEach(([key, data]) => {
        if (!Array.isArray(data)) return;
        queryClient.setQueryData(key, data.map((p: any) =>
          p.id === postId ? { ...p, comment_count: Math.max(0, (p.comment_count || 0) - 1) } : p,
        ));
      });
      toast({ title: 'Error', description: error.message || 'Failed to post comment', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await supabase.from('group_post_comments').delete().eq('id', commentId);
      if (error) throw error;
      return commentId;
    },
    onMutate: async (commentId) => {
      const prev = queryClient.getQueryData<PostComment[]>(queryKey);
      queryClient.setQueryData<PostComment[]>(queryKey, (p = []) =>
        p
          .filter((c) => c.id !== commentId)
          .map((c) => ({ ...c, replies: (c.replies || []).filter((r) => r.id !== commentId) })),
      );
      const postsQueries = queryClient.getQueriesData<any[]>({ queryKey: ['group-posts'] });
      postsQueries.forEach(([key, data]) => {
        if (!Array.isArray(data)) return;
        queryClient.setQueryData(key, data.map((p: any) =>
          p.id === postId ? { ...p, comment_count: Math.max(0, (p.comment_count || 0) - 1) } : p,
        ));
      });
      return { prev };
    },
    onError: (error: any, _id, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(queryKey, ctx.prev);
      toast({ title: 'Error', description: error.message || 'Failed to delete comment', variant: 'destructive' });
    },
  });

  const totalCount = comments.reduce((acc, c) => acc + 1 + (c.replies?.length || 0), 0);

  return {
    comments,
    loading,
    creating: createMutation.isPending,
    createComment: (content: string, parentCommentId?: string) =>
      createMutation.mutateAsync({
        content,
        parentCommentId,
        clientId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      }),
    deleteComment: deleteMutation.mutateAsync,
    refetch,
    totalCount,
  };
}
