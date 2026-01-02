import { useState, useEffect, useCallback } from 'react';
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

export function useGroupPosts(groupId: string | undefined) {
  const [posts, setPosts] = useState<GroupPost[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchPosts = useCallback(async () => {
    if (!groupId) return;
    
    setLoading(true);
    try {
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

      const postsWithData: GroupPost[] = (postsData || []).map(p => {
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

      setPosts(postsWithData);
    } catch (error) {
      console.error('Error fetching posts:', error);
      toast({
        title: 'Error',
        description: 'Failed to load posts',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [groupId, toast]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // Set up realtime subscription
  useEffect(() => {
    if (!groupId) return;

    const channel = supabase
      .channel(`group_posts_${groupId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'group_posts',
          filter: `group_id=eq.${groupId}`,
        },
        () => {
          fetchPosts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, fetchPosts]);

  const createPost = async (postData: {
    type: GroupPost['type'];
    title?: string;
    content?: string;
    session_date?: string;
    session_time?: string;
    max_players?: number;
    pinned?: boolean;
  }) => {
    if (!groupId) return null;

    try {
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

      toast({ title: 'Posted!', description: 'Your post has been shared with the group' });
      await fetchPosts();
      return data;
    } catch (error: any) {
      console.error('Error creating post:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create post',
        variant: 'destructive',
      });
      return null;
    }
  };

  const deletePost = async (postId: string) => {
    try {
      const { error } = await supabase
        .from('group_posts')
        .delete()
        .eq('id', postId);

      if (error) throw error;

      toast({ title: 'Deleted', description: 'Post has been removed' });
      await fetchPosts();
      return true;
    } catch (error: any) {
      console.error('Error deleting post:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete post',
        variant: 'destructive',
      });
      return false;
    }
  };

  const toggleReaction = async (postId: string, emoji: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Check if reaction exists
      const { data: existing } = await supabase
        .from('group_post_reactions')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', user.id)
        .eq('emoji', emoji)
        .single();

      if (existing) {
        // Remove reaction
        await supabase
          .from('group_post_reactions')
          .delete()
          .eq('id', existing.id);
      } else {
        // Add reaction
        await supabase
          .from('group_post_reactions')
          .insert({
            post_id: postId,
            user_id: user.id,
            emoji,
          });
      }

      await fetchPosts();
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
      await fetchPosts();
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
      await fetchPosts();
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
      await fetchPosts();
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
    createPost,
    deletePost,
    toggleReaction,
    togglePin,
    joinLfgPost,
    leaveLfgPost,
    refetch: fetchPosts,
  };
}
