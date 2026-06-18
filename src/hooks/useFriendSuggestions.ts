import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SuggestedFriend {
  id: string;
  display_name: string | null;
  full_name: string | null;
  avatar_url: string | null;
  current_rating: number | null;
  handle: string | null;
  reason: string;
  weight: number;
}

export function useFriendSuggestions() {
  const [suggestions, setSuggestions] = useState<SuggestedFriend[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSuggestions = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('suggest_friends');
      if (error) throw error;
      setSuggestions((data || []) as SuggestedFriend[]);
    } catch (err) {
      console.error('Error fetching friend suggestions:', err);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  return { suggestions, loading, refetch: fetchSuggestions };
}
