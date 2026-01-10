import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface VenueFollowPreferences {
  notify_new_events: boolean;
  notify_announcements: boolean;
  notify_schedule_changes: boolean;
}

interface VenueFollow {
  id: string;
  venue_id: string;
  user_id: string;
  followed_at: string;
  notify_new_events: boolean;
  notify_announcements: boolean;
  notify_schedule_changes: boolean;
}

/**
 * Hook to manage venue following for the current user
 */
export function useVenueFollow(venueId: string | undefined) {
  const queryClient = useQueryClient();

  // Check if user is following this venue
  const { data: followStatus, isLoading } = useQuery({
    queryKey: ['venue-follow', venueId],
    queryFn: async () => {
      if (!venueId) return null;
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('venue_followers')
        .select('*')
        .eq('venue_id', venueId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error checking follow status:', error);
        return null;
      }

      return data as VenueFollow | null;
    },
    enabled: !!venueId,
  });

  // Follow venue mutation
  const followMutation = useMutation({
    mutationFn: async (preferences?: Partial<VenueFollowPreferences>) => {
      if (!venueId) throw new Error('No venue ID');
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Must be logged in to follow venues');

      const { data, error } = await supabase
        .from('venue_followers')
        .insert({
          venue_id: venueId,
          user_id: user.id,
          notify_new_events: preferences?.notify_new_events ?? true,
          notify_announcements: preferences?.notify_announcements ?? true,
          notify_schedule_changes: preferences?.notify_schedule_changes ?? true,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venue-follow', venueId] });
      queryClient.invalidateQueries({ queryKey: ['my-followed-venues'] });
      toast.success('Now following this venue');
    },
    onError: (error: Error) => {
      console.error('Error following venue:', error);
      toast.error('Failed to follow venue');
    },
  });

  // Unfollow venue mutation
  const unfollowMutation = useMutation({
    mutationFn: async () => {
      if (!venueId) throw new Error('No venue ID');
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Must be logged in');

      const { error } = await supabase
        .from('venue_followers')
        .delete()
        .eq('venue_id', venueId)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venue-follow', venueId] });
      queryClient.invalidateQueries({ queryKey: ['my-followed-venues'] });
      toast.success('Unfollowed venue');
    },
    onError: (error: Error) => {
      console.error('Error unfollowing venue:', error);
      toast.error('Failed to unfollow venue');
    },
  });

  // Update notification preferences
  const updatePreferencesMutation = useMutation({
    mutationFn: async (preferences: Partial<VenueFollowPreferences>) => {
      if (!venueId || !followStatus) throw new Error('Not following this venue');
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Must be logged in');

      const { data, error } = await supabase
        .from('venue_followers')
        .update(preferences)
        .eq('venue_id', venueId)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venue-follow', venueId] });
      toast.success('Notification preferences updated');
    },
    onError: (error: Error) => {
      console.error('Error updating preferences:', error);
      toast.error('Failed to update preferences');
    },
  });

  // Toggle follow state
  const toggleFollow = async () => {
    if (followStatus) {
      await unfollowMutation.mutateAsync();
    } else {
      await followMutation.mutateAsync(undefined);
    }
  };

  return {
    isFollowing: !!followStatus,
    followStatus,
    isLoading,
    toggleFollow,
    follow: followMutation.mutate,
    unfollow: unfollowMutation.mutate,
    updatePreferences: updatePreferencesMutation.mutate,
    isToggling: followMutation.isPending || unfollowMutation.isPending,
  };
}

/**
 * Hook to get all venues the current user is following
 */
export function useMyFollowedVenues() {
  return useQuery({
    queryKey: ['my-followed-venues'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('venue_followers')
        .select(`
          *,
          venues:venue_id (
            id,
            name,
            slug,
            city,
            state,
            logo_url
          )
        `)
        .eq('user_id', user.id)
        .order('followed_at', { ascending: false });

      if (error) {
        console.error('Error fetching followed venues:', error);
        return [];
      }

      return data;
    },
  });
}

/**
 * Hook for venue owners to see their followers
 */
export function useVenueFollowers(venueId: string | undefined) {
  return useQuery({
    queryKey: ['venue-followers', venueId],
    queryFn: async () => {
      if (!venueId) return { count: 0, followers: [] };

      // Get recent followers with profile info (also get count)
      const { data, error, count } = await supabase
        .from('venue_followers')
        .select(`
          *,
          profiles:user_id (
            id,
            display_name,
            avatar_url
          )
        `, { count: 'exact' })
        .eq('venue_id', venueId)
        .order('followed_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching followers:', error);
        return { count: 0, followers: [] };
      }

      return {
        count: count || 0,
        followers: data || [],
      };
    },
    enabled: !!venueId,
  });
}
