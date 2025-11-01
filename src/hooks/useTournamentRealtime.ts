import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useTournamentRealtime = (
  eventId: string,
  onMatchUpdate: (payload: any) => void,
  onDivisionUpdate?: (payload: any) => void
) => {
  useEffect(() => {
    const matchChannel = supabase
      .channel(`tournament-${eventId}-matches`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tournaments_matches'
      }, onMatchUpdate)
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
  }, [eventId, onMatchUpdate, onDivisionUpdate]);
};
