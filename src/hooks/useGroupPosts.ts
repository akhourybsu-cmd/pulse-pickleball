import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface GroupPost {
  id: string;
  group_id: string;
  user_id: string;
  type: 'feed' | 'lfg' | 'announcement' | 'highlight' | 'poll';
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
    .from('profiles')
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
    };
  });
}

export function useGroupPosts(groupId: string | undefined) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: posts = [], isLoading: loading, refetch } = useQuery({
    queryKey: ['group-posts', groupId],
    queryFn: () => fetchGroupPosts(groupId!),
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
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
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('group_posts')
        .insert({
          group_id: groupId,
          user_id: user.id,
          ...postData,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: 'Posted!', description: 'Your post has been shared with the group' });
      queryClient.invalidateQueries({ queryKey: ['group-posts', groupId] });
    },
    onError: (error: any) => {
      console.error('Error creating post:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create post',
        variant: 'destructive',
      });
    },
  });

  const deletePostMutation = useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await supabase
        .from('group_posts')
        .delete()
        .eq('id', postId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Deleted', description: 'Post has been removed' });
      queryClient.invalidateQueries({ queryKey: ['group-posts', groupId] });
    },
    onError: (error: any) => {
      console.error('Error deleting post:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete post',
        variant: 'destructive',
      });
    },
  });

  const toggleReaction = async (postId: string, emoji: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: existing } = await supabase
        .from('group_post_reactions')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', user.id)
        .eq('emoji', emoji)
        .single();

      if (existing) {
        await supabase
          .from('group_post_reactions')
          .delete()
          .eq('id', existing.id);
      } else {
        await supabase
          .from('group_post_reactions')
          .insert({
            post_id: postId,
            user_id: user.id,
            emoji,
          });
      }

      queryClient.invalidateQueries({ queryKey: ['group-posts', groupId] });
    } catch (error: any) {
      console.error('Error toggling reaction:', error);
    }
  };

  const togglePin = async (postId: string, pinned: boolean) => {
    try {
      const { error } = await supabase
        .from('group_posts')
        .update({ pinned })
        .eq('id', postId);

      if (error) throw error;

      toast({ title: pinned ? 'Pinned' : 'Unpinned', description: `Post has been ${pinned ? 'pinned' : 'unpinned'}` });
      queryClient.invalidateQueries({ queryKey: ['group-posts', groupId] });
    } catch (error: any) {
      console.error('Error toggling pin:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update post',
        variant: 'destructive',
      });
    }
  };

  const joinLfgPost = async (postId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('group_post_participants')
        .insert({
          post_id: postId,
          user_id: user.id,
          status: 'joined',
        });

      if (error) throw error;

      toast({ title: "You're in!", description: 'You have joined this session' });
      queryClient.invalidateQueries({ queryKey: ['group-posts', groupId] });
      return true;
    } catch (error: any) {
      console.error('Error joining LFG post:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to join',
        variant: 'destructive',
      });
      return false;
    }
  };

  /**
   * Cast / change / toggle-off a poll vote via the cast_group_poll_vote RPC.
   * Optimistically updates the local cache so the bars animate immediately
   * — the realtime invalidation that follows reconciles with the server.
   */
  const castPollVote = async (postId: string, optionIdx: number) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Optimistic update: mutate cached posts in place so the bar moves now.
      queryClient.setQueryData<GroupPost[] | undefined>(['group-posts', groupId], (prev) => {
        if (!prev) return prev;
        return prev.map((p) => {
          if (p.id !== postId || !p.poll_options) return p;
          const counts = [...(p.poll_vote_counts ?? p.poll_options.map(() => 0))];
          const wasVote = p.poll_my_vote;
          let nextVote: number | null = optionIdx;
          if (wasVote === optionIdx) {
            // Toggle off
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
      toast({
        title: 'Vote failed',
        description: error.message || 'Could not record your vote',
        variant: 'destructive',
      });
      // Reconcile on error
      queryClient.invalidateQueries({ queryKey: ['group-posts', groupId] });
    }
  };

  const leaveLfgPost = async (postId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('group_post_participants')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({ title: 'Left', description: 'You have left this session' });
      queryClient.invalidateQueries({ queryKey: ['group-posts', groupId] });
      return true;
    } catch (error: any) {
      console.error('Error leaving LFG post:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to leave',
        variant: 'destructive',
      });
      return false;
    }
  };

  return {
    posts,
    loading,
    createPost: createPostMutation.mutateAsync,
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
