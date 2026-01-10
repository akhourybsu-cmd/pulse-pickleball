import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface VenueAnnouncement {
  id: string;
  venue_id: string;
  title: string;
  message: string;
  target_audience: 'followers' | 'past_attendees' | 'all';
  channels: string[];
  scheduled_for: string | null;
  sent_at: string | null;
  recipient_count: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface CreateAnnouncementInput {
  title: string;
  message: string;
  target_audience?: 'followers' | 'past_attendees' | 'all';
  channels?: string[];
  scheduled_for?: string | null;
  send_immediately?: boolean;
}

/**
 * Hook to manage venue announcements
 */
export function useVenueAnnouncements(venueId: string | undefined) {
  const queryClient = useQueryClient();

  // Fetch announcements for venue
  const { data: announcements, isLoading } = useQuery({
    queryKey: ['venue-announcements', venueId],
    queryFn: async () => {
      if (!venueId) return [];

      const { data, error } = await supabase
        .from('venue_announcements')
        .select('*')
        .eq('venue_id', venueId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching announcements:', error);
        return [];
      }

      return data as VenueAnnouncement[];
    },
    enabled: !!venueId,
  });

  // Create announcement
  const createAnnouncement = useMutation({
    mutationFn: async (input: CreateAnnouncementInput) => {
      if (!venueId) throw new Error('No venue ID');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Must be logged in');

      const { data, error } = await supabase
        .from('venue_announcements')
        .insert({
          venue_id: venueId,
          title: input.title,
          message: input.message,
          target_audience: input.target_audience || 'followers',
          channels: input.channels || ['in_app'],
          scheduled_for: input.scheduled_for,
          sent_at: input.send_immediately ? new Date().toISOString() : null,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // If sending immediately, trigger the edge function
      if (input.send_immediately) {
        try {
          await supabase.functions.invoke('send-venue-announcement', {
            body: { announcement_id: data.id },
          });
        } catch (e) {
          console.warn('Edge function not available:', e);
          // Still return data - edge function may not be deployed yet
        }
      }

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['venue-announcements', venueId] });
      toast.success(
        variables.send_immediately 
          ? 'Announcement sent' 
          : 'Announcement created'
      );
    },
    onError: (error: Error) => {
      console.error('Error creating announcement:', error);
      toast.error('Failed to create announcement');
    },
  });

  // Delete announcement
  const deleteAnnouncement = useMutation({
    mutationFn: async (announcementId: string) => {
      const { error } = await supabase
        .from('venue_announcements')
        .delete()
        .eq('id', announcementId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venue-announcements', venueId] });
      toast.success('Announcement deleted');
    },
    onError: (error: Error) => {
      console.error('Error deleting announcement:', error);
      toast.error('Failed to delete announcement');
    },
  });

  // Send scheduled announcement now
  const sendNow = useMutation({
    mutationFn: async (announcementId: string) => {
      const { data, error } = await supabase
        .from('venue_announcements')
        .update({ 
          sent_at: new Date().toISOString(),
          scheduled_for: null,
        })
        .eq('id', announcementId)
        .select()
        .single();

      if (error) throw error;

      // Trigger edge function
      try {
        await supabase.functions.invoke('send-venue-announcement', {
          body: { announcement_id: announcementId },
        });
      } catch (e) {
        console.warn('Edge function not available:', e);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venue-announcements', venueId] });
      toast.success('Announcement sent');
    },
    onError: (error: Error) => {
      console.error('Error sending announcement:', error);
      toast.error('Failed to send announcement');
    },
  });

  const sentAnnouncements = announcements?.filter(a => a.sent_at !== null) || [];
  const scheduledAnnouncements = announcements?.filter(a => a.sent_at === null && a.scheduled_for !== null) || [];
  const draftAnnouncements = announcements?.filter(a => a.sent_at === null && a.scheduled_for === null) || [];

  return {
    announcements,
    sentAnnouncements,
    scheduledAnnouncements,
    draftAnnouncements,
    isLoading,
    createAnnouncement: createAnnouncement.mutate,
    deleteAnnouncement: deleteAnnouncement.mutate,
    sendNow: sendNow.mutate,
    isCreating: createAnnouncement.isPending,
    isSending: sendNow.isPending,
  };
}
