import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useTournamentRealtime = (
  eventId: string,
  onMatchUpdate: (payload: any) => void,
  onDivisionUpdate?: (payload: any) => void,
  divisionIds?: string[]
) => {
  // Memoize the filter callback to handle division filtering
  const handleMatchUpdate = useCallback((payload: any) => {
    // If divisionIds provided, filter to only those divisions
    if (divisionIds && divisionIds.length > 0) {
      const matchDivisionId = payload.new?.division_id || payload.old?.division_id;
      if (matchDivisionId && !divisionIds.includes(matchDivisionId)) {
        return; // Ignore matches from other divisions
      }
    }
    onMatchUpdate(payload);
  }, [divisionIds, onMatchUpdate]);

  useEffect(() => {
    // Build match channel with optional filter
    const matchChannelConfig: any = {
      event: '*',
      schema: 'public',
      table: 'tournaments_matches',
    };
    
    // Note: Supabase realtime filter syntax for 'in' is limited, 
    // so we filter in the callback instead for multiple division IDs
    
    const matchChannel = supabase
      .channel(`tournament-${eventId}-matches`)
      .on('postgres_changes', matchChannelConfig, handleMatchUpdate)
      .subscribe();

    const divisionChannel = onDivisionUpdate ? supabase
      .channel(`tournament-${eventId}-divisions`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tournaments_divisions'
      }, onDivisionUpdate)
      .subscribe() : null;

    return () => {
      supabase.removeChannel(matchChannel);
      if (divisionChannel) supabase.removeChannel(divisionChannel);
    };
  }, [eventId, handleMatchUpdate, onDivisionUpdate]);
};
