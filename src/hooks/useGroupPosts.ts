import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface GroupPost {
  id: string;
  group_id: string;
  user_id: string;
  type: 'feed' | 'lfg' | 'announcement' | 'highlight' | 'poll' | 'round_robin';
  title: string | null;
  content: string | null;
  pinned: boolean;
  session_date: string | null;
  session_time: string | null;
  max_players: number | null;
  image_url: string | null;
  poll_options: { idx: number; text: string }[] | null;
  last_activity_at: string;
  created_at: string;
  updated_at: string;
  round_robin_event_id?: string | null;
  round_robin?: {
    id: string;
    name: string;
    date: string;
    start_time: string | null;
    num_courts: number;
    max_players: number | null;
    status: string;
    invite_code: string | null;
    registration_mode: string | null;
    player_count: number;
  } | null;
  profile?: {
    id: string;
    display_name: string | null;
    full_name: string;
    avatar_url: string | null;
    current_rating: number | null;
  };
  reactions?: { emoji: string; count: number; user_reacted: boolean }[];
  comment_count?: number;
  participant_count?: number;
  user_joined?: boolean;
  /** Per-option vote counts (length matches poll_options). Only set for type='poll'. */
  poll_vote_counts?: number[];
  /** The current viewer's option_idx, or null if they haven't voted. */
  poll_my_vote?: number | null;
}

async function fetchGroupPosts(groupId: string): Promise<GroupPost[]> {
  const { data: { user } } = await supabase.auth.getUser();
  
  // Fetch posts
  const { data: postsData, error } = await supabase
    .from('group_posts')
    .select('*')
    .eq('group_id', groupId)
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;

  // Fetch profiles for post authors
  const userIds = [...new Set((postsData || []).map(p => p.user_id))];
  const { data: profilesData } = await supabase
    .from('profiles_public')
    .select('id, display_name, full_name, avatar_url, current_rating')
    .in('id', userIds);

  const profilesMap = new Map((profilesData || []).map(p => [p.id, p]));

  // Fetch reactions for each post
  const postIds = (postsData || []).map(p => p.id);
  const { data: reactionsData } = await supabase
    .from('group_post_reactions')
    .select('post_id, emoji, user_id')
    .in('post_id', postIds);

  // Fetch comment counts
  const { data: commentsData } = await supabase
    .from('group_post_comments')
    .select('post_id')
    .in('post_id', postIds);

  // Fetch participants for LFG posts
  const { data: participantsData } = await supabase
    .from('group_post_participants')
    .select('post_id, user_id')
    .in('post_id', postIds);

  // Group participants by post
  const participantsMap = new Map<string, { count: number; userJoined: boolean }>();
  (participantsData || []).forEach(p => {
    const existing = participantsMap.get(p.post_id) || { count: 0, userJoined: false };
    existing.count++;
    if (user && p.user_id === user.id) existing.userJoined = true;
    participantsMap.set(p.post_id, existing);
  });

  // Group reactions by post
  const reactionsMap = new Map<string, { emoji: string; count: number; user_reacted: boolean }[]>();
  (reactionsData || []).forEach(r => {
    const existing = reactionsMap.get(r.post_id) || [];
    const emojiEntry = existing.find(e => e.emoji === r.emoji);
    if (emojiEntry) {
      emojiEntry.count++;
      if (user && r.user_id === user.id) emojiEntry.user_reacted = true;
    } else {
      existing.push({ emoji: r.emoji, count: 1, user_reacted: user?.id === r.user_id });
    }
    reactionsMap.set(r.post_id, existing);
  });

  // Count comments by post
  const commentCountMap = new Map<string, number>();
  (commentsData || []).forEach(c => {
    commentCountMap.set(c.post_id, (commentCountMap.get(c.post_id) || 0) + 1);
  });

  // Fetch poll votes (only for poll posts that have options defined).
  const pollIds = (postsData || [])
    .filter((p: any) => p.type === 'poll' && Array.isArray(p.poll_options) && p.poll_options.length > 0)
    .map(p => p.id);
  const pollVotesByPost = new Map<string, { counts: number[]; myVote: number | null }>();
  if (pollIds.length > 0) {
    const { data: votesData } = await supabase
      .from('group_poll_votes')
      .select('post_id, user_id, option_idx')
      .in('post_id', pollIds);

    (postsData || []).forEach((p: any) => {
      if (!pollIds.includes(p.id)) return;
      const counts = (p.poll_options as any[]).map(() => 0);
      let myVote: number | null = null;
      (votesData || []).forEach((v: any) => {
        if (v.post_id !== p.id) return;
        if (v.option_idx >= 0 && v.option_idx < counts.length) counts[v.option_idx]++;
        if (user && v.user_id === user.id) myVote = v.option_idx;
      });
      pollVotesByPost.set(p.id, { counts, myVote });
    });
  }

  // Fetch linked round-robin events for round_robin posts.
  const rrIds = Array.from(
    new Set(
      (postsData || [])
        .filter((p: any) => p.type === 'round_robin' && p.round_robin_event_id)
        .map((p: any) => p.round_robin_event_id as string)
    )
  );
  const rrMap = new Map<string, GroupPost['round_robin']>();
  if (rrIds.length > 0) {
    const { data: rrData } = await supabase
      .from('round_robin_events')
      .select('id, name, date, start_time, num_courts, max_players, status, invite_code, registration_mode')
      .in('id', rrIds);
    const { data: rrPlayers } = await supabase
      .from('round_robin_players')
      .select('event_id')
      .in('event_id', rrIds)
      .eq('active', true);
    const countMap = new Map<string, number>();
    (rrPlayers || []).forEach((row: any) => {
      countMap.set(row.event_id, (countMap.get(row.event_id) || 0) + 1);
    });
    (rrData || []).forEach((rr: any) => {
      rrMap.set(rr.id, { ...rr, player_count: countMap.get(rr.id) || 0 });
    });
  }

  return (postsData || []).map(p => {
    const participantInfo = participantsMap.get(p.id);
    const pollInfo = pollVotesByPost.get(p.id);
    return {
      ...p,
      type: p.type as GroupPost['type'],
      poll_options: (p.poll_options as GroupPost['poll_options']) ?? null,
      profile: profilesMap.get(p.user_id),
      reactions: reactionsMap.get(p.id) || [],
      comment_count: commentCountMap.get(p.id) || 0,
      participant_count: participantInfo?.count || 0,
      user_joined: participantInfo?.userJoined || false,
      poll_vote_counts: pollInfo?.counts,
      poll_my_vote: pollInfo?.myVote ?? null,
      round_robin: (p as any).round_robin_event_id ? rrMap.get((p as any).round_robin_event_id) ?? null : null,
    };
  });
}

export function useGroupPosts(groupId: string | undefined) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const queryKey = ['group-posts', groupId];

  const { data: posts = [], isLoading: loading, refetch } = useQuery({
    queryKey,
    queryFn: () => fetchGroupPosts(groupId!),
    // Realtime patches the cache directly — no periodic refetch needed.
    staleTime: Infinity,
    gcTime: 10 * 60 * 1000,
    enabled: !!groupId,
  });

  const createPostMutation = useMutation({
    mutationFn: async (postData: {
      type: GroupPost['type'];
      title?: string;
      content?: string;
      session_date?: string;
      session_time?: string;
      max_players?: number;
      pinned?: boolean;
      image_url?: string;
      poll_options?: { idx: number; text: string }[];
      _clientId: string;
    }) => {
      const { _clientId, ...insertData } = postData;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('group_posts')
        .insert({ group_id: groupId, user_id: user.id, ...insertData })
        .select()
        .single();
      if (error) throw error;
      return { row: data, clientId: _clientId };
    },
    onMutate: async (postData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const cachedAuthor = (queryClient.getQueryData<GroupPost[]>(queryKey) || [])
        .find((p) => p.user_id === user.id)?.profile;
      const now = new Date().toISOString();
      const optimistic: GroupPost = {
        id: `temp-${postData._clientId}`,
        group_id: groupId!,
        user_id: user.id,
        type: postData.type,
        title: postData.title ?? null,
        content: postData.content ?? null,
        pinned: postData.pinned ?? false,
        session_date: postData.session_date ?? null,
        session_time: postData.session_time ?? null,
        max_players: postData.max_players ?? null,
        image_url: postData.image_url ?? null,
        poll_options: postData.poll_options ?? null,
        last_activity_at: now,
        created_at: now,
        updated_at: now,
        profile: cachedAuthor,
        reactions: [],
        comment_count: 0,
        participant_count: 0,
        user_joined: false,
        poll_vote_counts: postData.poll_options?.map(() => 0),
        poll_my_vote: null,
      };
      queryClient.setQueryData<GroupPost[]>(queryKey, (prev = []) => {
        const pinned = prev.filter((p) => p.pinned);
        const rest = prev.filter((p) => !p.pinned);
        return optimistic.pinned
          ? [optimistic, ...pinned, ...rest]
          : [...pinned, optimistic, ...rest];
      });
    },
    onSuccess: ({ row, clientId }) => {
      queryClient.setQueryData<GroupPost[]>(queryKey, (prev = []) =>
        prev.map((p) =>
          p.id === `temp-${clientId}`
            ? { ...p, ...(row as any), id: row.id }
            : p,
        ),
      );
      toast({ title: 'Posted!', description: 'Your post has been shared with the group' });
    },
    onError: (error: any, postData) => {
      queryClient.setQueryData<GroupPost[]>(queryKey, (prev = []) =>
        prev.filter((p) => p.id !== `temp-${postData._clientId}`),
      );
      console.error('Error creating post:', error);
      toast({ title: 'Error', description: error.message || 'Failed to create post', variant: 'destructive' });
    },
  });

  const deletePostMutation = useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await supabase.from('group_posts').delete().eq('id', postId);
      if (error) throw error;
    },
    onMutate: async (postId) => {
      const prev = queryClient.getQueryData<GroupPost[]>(queryKey);
      queryClient.setQueryData<GroupPost[]>(queryKey, (p = []) => p.filter((x) => x.id !== postId));
      return { prev };
    },
    onSuccess: () => {
      toast({ title: 'Deleted', description: 'Post has been removed' });
    },
    onError: (error: any, _id, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(queryKey, ctx.prev);
      toast({ title: 'Error', description: error.message || 'Failed to delete post', variant: 'destructive' });
    },
  });

  const toggleReaction = async (postId: string, emoji: string) => {
    const prev = queryClient.getQueryData<GroupPost[]>(queryKey);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Optimistic: flip the reaction now.
    let wasReacted = false;
    queryClient.setQueryData<GroupPost[]>(queryKey, (p = []) =>
      p.map((post) => {
        if (post.id !== postId) return post;
        const reactions = [...(post.reactions || [])];
        const entry = reactions.find((r) => r.emoji === emoji);
        if (entry?.user_reacted) {
          wasReacted = true;
          entry.count = Math.max(0, entry.count - 1);
          entry.user_reacted = false;
        } else if (entry) {
          entry.count += 1;
          entry.user_reacted = true;
        } else {
          reactions.push({ emoji, count: 1, user_reacted: true });
        }
        return { ...post, reactions: reactions.filter((r) => r.count > 0) };
      }),
    );

    try {
      if (wasReacted) {
        await supabase
          .from('group_post_reactions')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id)
          .eq('emoji', emoji);
      } else {
        await supabase
          .from('group_post_reactions')
          .insert({ post_id: postId, user_id: user.id, emoji });
      }
    } catch (error: any) {
      console.error('Error toggling reaction:', error);
      if (prev) queryClient.setQueryData(queryKey, prev);
    }
  };

  const togglePin = async (postId: string, pinned: boolean) => {
    const prev = queryClient.getQueryData<GroupPost[]>(queryKey);
    queryClient.setQueryData<GroupPost[]>(queryKey, (p = []) => {
      const next = p.map((post) => (post.id === postId ? { ...post, pinned } : post));
      // re-sort pinned-first
      return [...next.filter((x) => x.pinned), ...next.filter((x) => !x.pinned)];
    });
    try {
      const { error } = await supabase.from('group_posts').update({ pinned }).eq('id', postId);
      if (error) throw error;
      toast({ title: pinned ? 'Pinned' : 'Unpinned', description: `Post has been ${pinned ? 'pinned' : 'unpinned'}` });
    } catch (error: any) {
      if (prev) queryClient.setQueryData(queryKey, prev);
      toast({ title: 'Error', description: error.message || 'Failed to update post', variant: 'destructive' });
    }
  };

  const joinLfgPost = async (postId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const prev = queryClient.getQueryData<GroupPost[]>(queryKey);
    queryClient.setQueryData<GroupPost[]>(queryKey, (p = []) =>
      p.map((post) =>
        post.id === postId
          ? { ...post, user_joined: true, participant_count: (post.participant_count || 0) + 1 }
          : post,
      ),
    );
    try {
      const { error } = await supabase
        .from('group_post_participants')
        .insert({ post_id: postId, user_id: user.id, status: 'joined' });
      if (error) throw error;
      toast({ title: "You're in!", description: 'You have joined this session' });
      return true;
    } catch (error: any) {
      if (prev) queryClient.setQueryData(queryKey, prev);
      toast({ title: 'Error', description: error.message || 'Failed to join', variant: 'destructive' });
      return false;
    }
  };

  const leaveLfgPost = async (postId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const prev = queryClient.getQueryData<GroupPost[]>(queryKey);
    queryClient.setQueryData<GroupPost[]>(queryKey, (p = []) =>
      p.map((post) =>
        post.id === postId
          ? { ...post, user_joined: false, participant_count: Math.max(0, (post.participant_count || 0) - 1) }
          : post,
      ),
    );
    try {
      const { error } = await supabase
        .from('group_post_participants')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', user.id);
      if (error) throw error;
      toast({ title: 'Left', description: 'You have left this session' });
      return true;
    } catch (error: any) {
      if (prev) queryClient.setQueryData(queryKey, prev);
      toast({ title: 'Error', description: error.message || 'Failed to leave', variant: 'destructive' });
      return false;
    }
  };

  /** Cast / change / toggle-off a poll vote (optimistic, unchanged behavior). */
  const castPollVote = async (postId: string, optionIdx: number) => {
    const prev = queryClient.getQueryData<GroupPost[]>(queryKey);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      queryClient.setQueryData<GroupPost[]>(queryKey, (prevPosts) => {
        if (!prevPosts) return prevPosts;
        return prevPosts.map((p) => {
          if (p.id !== postId || !p.poll_options) return p;
          const counts = [...(p.poll_vote_counts ?? p.poll_options.map(() => 0))];
          const wasVote = p.poll_my_vote;
          let nextVote: number | null = optionIdx;
          if (wasVote === optionIdx) {
            counts[optionIdx] = Math.max(0, counts[optionIdx] - 1);
            nextVote = null;
          } else {
            if (wasVote != null) counts[wasVote] = Math.max(0, counts[wasVote] - 1);
            counts[optionIdx] = (counts[optionIdx] ?? 0) + 1;
          }
          return { ...p, poll_vote_counts: counts, poll_my_vote: nextVote };
        });
      });

      const { error } = await supabase.rpc('cast_group_poll_vote', {
        p_post_id: postId,
        p_option_idx: optionIdx,
      });
      if (error) throw error;
    } catch (error: any) {
      console.error('Error casting poll vote:', error);
      if (prev) queryClient.setQueryData(queryKey, prev);
      toast({ title: 'Vote failed', description: error.message || 'Could not record your vote', variant: 'destructive' });
    }
  };

  type CreatePostInput = {
    type: GroupPost['type'];
    title?: string;
    content?: string;
    session_date?: string;
    session_time?: string;
    max_players?: number;
    pinned?: boolean;
    image_url?: string;
    poll_options?: { idx: number; text: string }[];
  };

  return {
    posts,
    loading,
    createPost: (data: CreatePostInput) =>
      createPostMutation.mutateAsync({
        ...data,
        _clientId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      }),
    deletePost: deletePostMutation.mutateAsync,
    toggleReaction,
    togglePin,
    joinLfgPost,
    leaveLfgPost,
    castPollVote,
    refetch,
  };
}

// Export the fetch function for prefetching
export { fetchGroupPosts };
