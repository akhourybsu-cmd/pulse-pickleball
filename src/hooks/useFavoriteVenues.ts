import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface FavoriteVenue {
  id: string;
  user_id: string;
  venue_id: string;
  created_at: string;
}

export function useFavoriteVenues() {
  const [favorites, setFavorites] = useState<FavoriteVenue[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFavorites = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setFavorites([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('player_favorite_venues')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFavorites(data || []);
    } catch (error) {
      console.error('Error fetching favorite venues:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  const addFavorite = async (venueId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { error } = await supabase
        .from('player_favorite_venues')
        .insert({ user_id: user.id, venue_id: venueId });

      if (error) throw error;
      await fetchFavorites();
      return true;
    } catch (error) {
      console.error('Error adding favorite venue:', error);
      return false;
    }
  };

  const removeFavorite = async (venueId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { error } = await supabase
        .from('player_favorite_venues')
        .delete()
        .eq('user_id', user.id)
        .eq('venue_id', venueId);

      if (error) throw error;
      await fetchFavorites();
      return true;
    } catch (error) {
      console.error('Error removing favorite venue:', error);
      return false;
    }
  };

  const isFavorite = (venueId: string) => {
    return favorites.some(f => f.venue_id === venueId);
  };

  const toggleFavorite = async (venueId: string) => {
    if (isFavorite(venueId)) {
      return removeFavorite(venueId);
    } else {
      return addFavorite(venueId);
    }
  };

  return {
    favorites,
    loading,
    refetch: fetchFavorites,
    addFavorite,
    removeFavorite,
    isFavorite,
    toggleFavorite
  };
}
