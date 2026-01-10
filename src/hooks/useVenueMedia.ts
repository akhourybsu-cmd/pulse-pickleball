import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface VenueMediaItem {
  id: string;
  venue_id: string;
  media_url: string;
  media_type: string;
  caption: string | null;
  sort_order: number;
  created_at: string;
}

export function useVenueMedia(venueId: string | null) {
  const [media, setMedia] = useState<VenueMediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchMedia = useCallback(async () => {
    if (!venueId) {
      setMedia([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('venue_media')
        .select('*')
        .eq('venue_id', venueId)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setMedia(data as VenueMediaItem[]);
    } catch (error: any) {
      console.error('Error fetching venue media:', error);
    } finally {
      setLoading(false);
    }
  }, [venueId]);

  useEffect(() => {
    fetchMedia();
  }, [fetchMedia]);

  const addMedia = async (mediaUrl: string, caption?: string) => {
    if (!venueId) return null;

    try {
      setSaving(true);
      const maxSortOrder = media.length > 0 
        ? Math.max(...media.map(m => m.sort_order)) + 1 
        : 0;

      const { data, error } = await supabase
        .from('venue_media')
        .insert({
          venue_id: venueId,
          media_url: mediaUrl,
          caption: caption || null,
          sort_order: maxSortOrder
        })
        .select()
        .single();

      if (error) throw error;
      setMedia(prev => [...prev, data as VenueMediaItem]);
      toast.success('Photo added');
      return data as VenueMediaItem;
    } catch (error: any) {
      console.error('Error adding media:', error);
      toast.error('Failed to add photo');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const updateMedia = async (mediaId: string, updates: Partial<VenueMediaItem>) => {
    try {
      setSaving(true);
      const { error } = await supabase
        .from('venue_media')
        .update(updates)
        .eq('id', mediaId);

      if (error) throw error;
      setMedia(prev => prev.map(m => m.id === mediaId ? { ...m, ...updates } : m));
      toast.success('Photo updated');
      return true;
    } catch (error: any) {
      console.error('Error updating media:', error);
      toast.error('Failed to update photo');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const deleteMedia = async (mediaId: string) => {
    try {
      setSaving(true);
      const { error } = await supabase
        .from('venue_media')
        .delete()
        .eq('id', mediaId);

      if (error) throw error;
      setMedia(prev => prev.filter(m => m.id !== mediaId));
      toast.success('Photo deleted');
      return true;
    } catch (error: any) {
      console.error('Error deleting media:', error);
      toast.error('Failed to delete photo');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const reorderMedia = async (orderedIds: string[]) => {
    try {
      setSaving(true);
      const updates = orderedIds.map((id, index) => ({
        id,
        sort_order: index
      }));

      // Update each item's sort order
      for (const update of updates) {
        await supabase
          .from('venue_media')
          .update({ sort_order: update.sort_order })
          .eq('id', update.id);
      }

      setMedia(prev => {
        const mediaMap = new Map(prev.map(m => [m.id, m]));
        return orderedIds
          .map((id, index) => {
            const item = mediaMap.get(id);
            return item ? { ...item, sort_order: index } : null;
          })
          .filter(Boolean) as VenueMediaItem[];
      });
      
      return true;
    } catch (error: any) {
      console.error('Error reordering media:', error);
      toast.error('Failed to reorder photos');
      return false;
    } finally {
      setSaving(false);
    }
  };

  return {
    media,
    loading,
    saving,
    refetch: fetchMedia,
    addMedia,
    updateMedia,
    deleteMedia,
    reorderMedia
  };
}
