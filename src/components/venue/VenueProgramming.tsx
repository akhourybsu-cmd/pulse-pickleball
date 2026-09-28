import { useMemo, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import type { VenueDaySession } from '@/hooks/useVenueDay';
import { programFilterState } from '@/lib/venues/programExperience';
import { EVENT_ICONS, VenueEventCard } from './VenueEventCard';
interface VenueProgrammingProps {
  initialFilter?: string;
  hideFilters?: boolean;
  timeZone?: string | null;
  sessions: VenueDaySession[];
  /** eventId → confirmed sign-ups. */
  going: Record<string, number>;
  loading: boolean;
  venueName?: string | null;
  accent?: string | null;
  onPick?: (sessionId: string) => void;
  viewerRsvpByEvent?: Record<string, string | null | undefined>;
}


export function VenueProgramming({ initialFilter = 'all', hideFilters = false, timeZone, sessions, going, loading, venueName, onPick, viewerRsvpByEvent = {} }: VenueProgrammingProps) {
  const [filter, setFilter] = useState(initialFilter);
  const { available, active, shown } = useMemo(() => programFilterState(sessions, filter), [sessions, filter]);
  if (loading) return <div className="space-y-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-44 w-full rounded-[20px]" />)}</div>;
  if (!sessions.length) return <div className="rounded-2xl bg-card px-5 py-8 text-center"><p className="text-sm font-semibold">Nothing scheduled</p><p className="mt-1 text-sm text-muted-foreground">Try another day or a different play category.</p></div>;
  return <div className="space-y-4">
    {!hideFilters && available.length > 1 && <div className="scrollbar-hide -mx-1 overflow-x-auto px-1 pb-1 lg:overflow-visible">
      <div className="flex min-w-max gap-2 lg:min-w-0 lg:flex-wrap" role="group" aria-label="Filter venue programs">
        {available.map(f => { const Icon = EVENT_ICONS[f.value] ?? CalendarDays; return <button key={f.value} type="button" onClick={() => setFilter(f.value)} aria-pressed={active === f.value} className="venue-event-filter"><Icon aria-hidden className="h-4 w-4" />{f.label}</button>; })}
      </div>
    </div>}
    <div className="space-y-3">{shown.map(session => <VenueEventCard key={session.id} event={session} timeZone={timeZone} going={going[session.id] ?? 0} venueName={venueName} onPick={onPick} viewerRsvp={viewerRsvpByEvent[session.id]} />)}</div>
  </div>;
}
