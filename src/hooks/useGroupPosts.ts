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
  poll_options: any;
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

  return (postsData || []).map(p => {
    const participantInfo = participantsMap.get(p.id);
    return {
      ...p,
      type: p.type as GroupPost['type'],
      profile: profilesMap.get(p.user_id),
      reactions: reactionsMap.get(p.id) || [],
      comment_count: commentCountMap.get(p.id) || 0,
      participant_count: participantInfo?.count || 0,
      user_joined: participantInfo?.userJoined || false,
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
    refetch,
  };
}

// Export the fetch function for prefetching
export { fetchGroupPosts };
