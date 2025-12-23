import { useState, useEffect } from 'react';
import { Users, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';

interface Registration {
  id: string;
  user_id: string;
  status: string;
  profile?: {
    first_name: string | null;
    last_name: string | null;
  };
}

interface EventRosterViewProps {
  eventId: string;
  primaryColor?: string;
}

// Format as "First Name, Last Initial."
function formatPlayerName(firstName: string | null, lastName: string | null): string {
  const first = firstName?.trim() || 'Player';
  const lastInitial = lastName?.charAt(0)?.toUpperCase() || '';
  return lastInitial ? `${first} ${lastInitial}.` : first;
}

export function EventRosterView({ eventId, primaryColor = '#FF6B35' }: EventRosterViewProps) {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const fetchRoster = async () => {
      setLoading(true);
      try {
        // Fetch registrations
        const { data: regs, error: regsError } = await supabase
          .from('venue_event_registrations')
          .select('id, user_id, status')
          .eq('event_id', eventId)
          .eq('status', 'registered')
          .order('registered_at', { ascending: true });

        if (regsError) throw regsError;

        if (!regs || regs.length === 0) {
          setRegistrations([]);
          setLoading(false);
          return;
        }

        // Fetch profiles for registered users
        const userIds = regs.map(r => r.user_id);
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, first_name, last_name')
          .in('id', userIds);

        if (profilesError) {
          console.error('Error fetching profiles:', profilesError);
        }

        // Map profiles to registrations
        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
        const enrichedRegs = regs.map(reg => ({
          ...reg,
          profile: profileMap.get(reg.user_id) || { first_name: null, last_name: null }
        }));

        setRegistrations(enrichedRegs);
      } catch (err) {
        console.error('Error fetching roster:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchRoster();
  }, [eventId]);

  if (loading) {
    return (
      <div className="space-y-2 py-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-32" />
      </div>
    );
  }

  if (registrations.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-2">
        No participants yet. Be the first to register!
      </div>
    );
  }

  const displayCount = expanded ? registrations.length : 3;
  const visibleRegs = registrations.slice(0, displayCount);
  const hasMore = registrations.length > 3;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Users className="w-4 h-4" style={{ color: primaryColor }} />
        <span>Who's Going ({registrations.length})</span>
      </div>
      
      <div className="flex flex-wrap gap-2">
        {visibleRegs.map((reg) => (
          <span 
            key={reg.id} 
            className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-muted"
          >
            {formatPlayerName(reg.profile?.first_name, reg.profile?.last_name)}
          </span>
        ))}
      </div>
      
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs flex items-center gap-1 hover:underline"
          style={{ color: primaryColor }}
        >
          {expanded ? (
            <>
              <ChevronUp className="w-3 h-3" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="w-3 h-3" />
              Show all {registrations.length} participants
            </>
          )}
        </button>
      )}
    </div>
  );
}
