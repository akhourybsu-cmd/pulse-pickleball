import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ActivityPost {
  id: string;
  type: 'post' | 'lfg';
  content: string | null;
  title: string | null;
  created_at: string;
  group_id: string;
  group_name: string;
  user_id: string;
  profile: {
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  reactions_count: number;
  comments_count: number;
}

export interface ActivityEvent {
  id: string;
  title: string;
  start_time: string;
  end_time: string | null;
  description: string | null;
  capacity: number | null;
  group_id: string;
  group_name: string;
  rsvp_count: number;
}

export function useCommunityActivity() {
  const [posts, setPosts] = useState<ActivityPost[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActivity = useCallback(async () => {
    try {
      setLoading(true);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setPosts([]);
        setUpcomingEvents([]);
        return;
      }

      // Get user's group IDs where they are active members. The enum is
      // 'active' | 'pending' | 'banned' — the prior 'approved' filter
      // matched zero rows, so the activity feed silently returned no
      // posts or upcoming events for everyone.
      const { data: memberships, error: memberError } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', user.id)
        .eq('status', 'active');

      if (memberError) throw memberError;
      
      const groupIds = memberships?.map(m => m.group_id) || [];
      
      if (groupIds.length === 0) {
        setPosts([]);
        setUpcomingEvents([]);
        setLoading(false);
        return;
      }

      // Fetch recent posts from those groups (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: postsData, error: postsError } = await supabase
        .from('group_posts')
        .select(`
          id,
          type,
          content,
          title,
          created_at,
          group_id,
          user_id,
          groups!inner(name)
        `)
        .in('group_id', groupIds)
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(20);

      if (postsError) throw postsError;

      // Get profiles for post authors
      const userIds = [...new Set(postsData?.map(p => p.user_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles_public')
        .select('id, display_name, avatar_url')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      // Get reaction counts for posts
      const postIds = postsData?.map(p => p.id) || [];
      const { data: reactions } = await supabase
        .from('group_post_reactions')
        .select('post_id')
        .in('post_id', postIds);

      const reactionCounts = new Map<string, number>();
      reactions?.forEach(r => {
        reactionCounts.set(r.post_id, (reactionCounts.get(r.post_id) || 0) + 1);
      });

      // Get comment counts for posts
      const { data: comments } = await supabase
        .from('group_post_comments')
        .select('post_id')
        .in('post_id', postIds);

      const commentCounts = new Map<string, number>();
      comments?.forEach(c => {
        commentCounts.set(c.post_id, (commentCounts.get(c.post_id) || 0) + 1);
      });

      // Transform posts data
      const transformedPosts: ActivityPost[] = (postsData || []).map(post => ({
        id: post.id,
        type: post.type as 'post' | 'lfg',
        content: post.content,
        title: post.title,
        created_at: post.created_at || '',
        group_id: post.group_id,
        group_name: (post.groups as { name: string })?.name || 'Unknown Group',
        user_id: post.user_id,
        profile: profileMap.get(post.user_id) || null,
        reactions_count: reactionCounts.get(post.id) || 0,
        comments_count: commentCounts.get(post.id) || 0,
      }));

      setPosts(transformedPosts);

      // Fetch upcoming events from those groups
      const { data: eventsData, error: eventsError } = await supabase
        .from('group_events')
        .select(`
          id,
          title,
          start_time,
          end_time,
          description,
          capacity,
          group_id,
          groups!inner(name)
        `)
        .in('group_id', groupIds)
        .gte('start_time', new Date().toISOString())
        .order('start_time', { ascending: true })
        .limit(10);

      if (eventsError) throw eventsError;

      // Get RSVP counts for events
      const eventIds = eventsData?.map(e => e.id) || [];
      const { data: rsvps } = await supabase
        .from('group_event_rsvps')
        .select('event_id')
        .in('event_id', eventIds)
        .eq('status', 'going');

      const rsvpCounts = new Map<string, number>();
      rsvps?.forEach(r => {
        rsvpCounts.set(r.event_id, (rsvpCounts.get(r.event_id) || 0) + 1);
      });

      // Transform events data
      const transformedEvents: ActivityEvent[] = (eventsData || []).map(event => ({
        id: event.id,
        title: event.title,
        start_time: event.start_time,
        end_time: event.end_time,
        description: event.description,
        capacity: event.capacity,
        group_id: event.group_id,
        group_name: (event.groups as { name: string })?.name || 'Unknown Group',
        rsvp_count: rsvpCounts.get(event.id) || 0,
      }));

      setUpcomingEvents(transformedEvents);
    } catch (error) {
      console.error('Error fetching community activity:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  return {
    posts,
    upcomingEvents,
    loading,
    refetch: fetchActivity,
  };
}
