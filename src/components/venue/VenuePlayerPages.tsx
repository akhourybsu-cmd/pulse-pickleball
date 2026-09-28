import { Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { VenueLoadState } from './VenueLoadState';
import { VenueEventCard } from './VenueEventCard';
import { filterVenueOccasions, type VenueEventFilter, type VenueOccasion } from '@/lib/venues/events';

export function VenuePageHeading({ title, description, onAdd }: { title: string; description?: string; onAdd?: () => void }) {
  return <header className="mb-5"><div className="flex min-w-0 items-center justify-between gap-3"><h2 className="min-w-0 break-words text-xl font-semibold tracking-tight">{title}</h2>
    {onAdd && <button type="button" aria-label="Add venue program" onClick={onAdd} className="club-text-action shrink-0"><Plus className="h-4 w-4" />Add</button>}
    </div>{description && <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>}</header>;
}

export function VenueFilter({ active, children, onClick }: { active: boolean; children: ReactNode; onClick: () => void }) {
  return <button type="button" aria-pressed={active} onClick={onClick} className="venue-event-filter">{children}</button>;
}

export function VenuePlayCategories({ category, hasBooking, onChange, onBook, onLeagues }: {
  category: string; hasBooking: boolean; onChange: (category: string) => void; onBook: () => void; onLeagues: () => void;
}) {
  return <div className="scrollbar-hide mb-5 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Ways to play">
    <VenueFilter active={category === 'all'} onClick={() => onChange('all')}>All play</VenueFilter>
    <VenueFilter active={category === 'open_play'} onClick={() => onChange('open_play')}>Open Play</VenueFilter>
    <VenueFilter active={category === 'clinic'} onClick={() => onChange('clinic')}>Clinics</VenueFilter>
    {hasBooking && <VenueFilter active={category === 'book'} onClick={onBook}>Court Reservations</VenueFilter>}
    <VenueFilter active={false} onClick={onLeagues}>Leagues</VenueFilter>
    <VenueFilter active={category === 'practice'} onClick={() => onChange('practice')}>Practice</VenueFilter>
  </div>;
}

const EVENT_FILTERS: Array<[VenueEventFilter, string]> = [['upcoming', 'Upcoming'], ['competition', 'Competitions'], ['leagues', 'Leagues'], ['social', 'Social']];
const EVENT_FORMATS = { competition: 'round_robin', leagues: 'league', social: 'social', special: 'other' };

export function VenueEventsPage({ name, events, filter, onFilter, loading, error, onRetry, onAdd, onProgram, onLeague, timeZone }: {
  name: string; events: VenueOccasion[]; filter: VenueEventFilter; onFilter: (filter: VenueEventFilter) => void;
  loading?: boolean; error?: boolean; onRetry: () => void; onAdd?: () => void;
  onProgram: (id: string) => void; onLeague: (id: string) => void; timeZone?: string | null;
}) {
  const shown = filterVenueOccasions(events, filter);
  return <div className="max-w-3xl space-y-5">
    <VenuePageHeading title="Events" description={'Competitions, leagues and special events at ' + name + '.'} onAdd={onAdd} />
    <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filter venue events">{EVENT_FILTERS.map(([value, label]) => <VenueFilter key={value} active={filter === value} onClick={() => onFilter(value)}>{label}</VenueFilter>)}</div>
    {error ? <VenueLoadState title="Events unavailable" description="We couldn’t load upcoming events. Please try again." onRetry={onRetry} /> : loading ? <Skeleton aria-label="Loading venue events" className="h-32 rounded-2xl" /> : shown.length === 0 ? <div className="rounded-2xl bg-card px-5 py-8 text-center"><h3 className="text-sm font-semibold">{filter === 'upcoming' ? 'More events are on the way' : 'No ' + (filter === 'leagues' ? 'active leagues' : filter === 'competition' ? 'upcoming competitions' : 'upcoming socials')}</h3><p className="mt-2 text-sm text-muted-foreground">{filter === 'upcoming' ? 'Check back for the next special event at this venue.' : 'Try Upcoming to see everything happening here.'}</p></div> :
      <div className="space-y-3">{shown.map(event => <VenueEventCard key={event.id} timeZone={timeZone} event={{ price_cents:event.price_cents,currency:event.currency,registration_paused:event.registration_paused,id: event.id, title: event.title, description: event.description, start_time: event.start, end_time: event.end, event_format: EVENT_FORMATS[event.kind] }} onPick={() => event.programId ? onProgram(event.programId) : event.leagueId && onLeague(event.leagueId)} />)}</div>}
  </div>;
}
