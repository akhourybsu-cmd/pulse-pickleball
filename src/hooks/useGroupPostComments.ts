import { useState, useEffect, useCallback } from 'react';
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

export function useGroupPostComments(postId: string | undefined) {
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();

  const fetchComments = useCallback(async () => {
    if (!postId) return;
    
    setLoading(true);
    try {
      // Fetch all comments for this post
      const { data: commentsData, error } = await supabase
        .from('group_post_comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Fetch profiles for comment authors
      const userIds = [...new Set((commentsData || []).map(c => c.user_id))];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, display_name, full_name, avatar_url')
        .in('id', userIds);

      const profilesMap = new Map((profilesData || []).map(p => [p.id, p]));

      // Build nested comment structure
      const commentsWithProfiles = (commentsData || []).map(c => ({
        ...c,
        profile: profilesMap.get(c.user_id),
        replies: [] as PostComment[],
      }));

      // Separate top-level comments and replies
      const topLevel: PostComment[] = [];
      const repliesMap = new Map<string, PostComment[]>();

      commentsWithProfiles.forEach(c => {
        if (c.parent_comment_id) {
          const existing = repliesMap.get(c.parent_comment_id) || [];
          existing.push(c);
          repliesMap.set(c.parent_comment_id, existing);
        } else {
          topLevel.push(c);
        }
      });

      // Attach replies to parents
      topLevel.forEach(c => {
        c.replies = repliesMap.get(c.id) || [];
      });

      setComments(topLevel);
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // Realtime subscription
  useEffect(() => {
    if (!postId) return;

    const channel = supabase
      .channel(`post_comments_${postId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'group_post_comments',
          filter: `post_id=eq.${postId}`,
        },
        () => fetchComments()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [postId, fetchComments]);

  const createComment = async (content: string, parentCommentId?: string) => {
    if (!postId || !content.trim()) return null;

    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('group_post_comments')
        .insert({
          post_id: postId,
          user_id: user.id,
          content: content.trim(),
          parent_comment_id: parentCommentId || null,
        })
        .select()
        .single();

      if (error) throw error;

      await fetchComments();
      return data;
    } catch (error: any) {
      console.error('Error creating comment:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to post comment',
        variant: 'destructive',
      });
      return null;
    } finally {
      setCreating(false);
    }
  };

  const deleteComment = async (commentId: string) => {
    try {
      const { error } = await supabase
        .from('group_post_comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;

      toast({ title: 'Deleted', description: 'Comment removed' });
      await fetchComments();
      return true;
    } catch (error: any) {
      console.error('Error deleting comment:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete comment',
        variant: 'destructive',
      });
      return false;
    }
  };

  return {
    comments,
    loading,
    creating,
    createComment,
    deleteComment,
    refetch: fetchComments,
    totalCount: comments.reduce((acc, c) => acc + 1 + (c.replies?.length || 0), 0),
  };
}