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

  /**
   * Dismiss a suggestion. Optimistically removes the row from local
   * state so the X-tap feels instant, then writes to
   * friend_suggestion_dismissals via the dismiss_friend_suggestion RPC.
   * On error we re-fetch the canonical list to roll back without
   * having to remember the prior position.
   */
  const dismissSuggestion = useCallback(async (userId: string) => {
    setSuggestions(prev => prev.filter(s => s.id !== userId));
    try {
      const { error } = await supabase.rpc('dismiss_friend_suggestion' as any, {
        p_target_user_id: userId,
      });
      if (error) throw error;
    } catch (err) {
      console.error('Error dismissing suggestion:', err);
      // Rollback by reloading the canonical list.
      fetchSuggestions();
    }
  }, [fetchSuggestions]);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  return { suggestions, loading, refetch: fetchSuggestions, dismissSuggestion };
}
