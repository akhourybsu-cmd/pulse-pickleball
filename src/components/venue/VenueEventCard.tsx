import { CalendarDays, Check, ChevronRight, Clock3, GraduationCap, LayoutGrid, Sparkles, Target, Trophy, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { clubSkill } from '@/lib/venues/clubPresentation';
import { EVENT_LABELS, eventSchedule } from '@/lib/venues/eventPresentation';
import { programPhase } from '@/lib/venues/programExperience';
import { programService } from '@/lib/venues/servicePresentation';

export interface VenueCardEvent {
  id: string; title: string; start_time: string | null; end_time?: string | null;
  event_format?: string; description?: string | null; capacity?: number | null;
  skill_level_min?: number | null; skill_level_max?: number | null; rr_courts?: number | null;
}
export const EVENT_ICONS: Record<string, typeof Users> = {
  open_play: Users, clinic: GraduationCap, practice: Target, round_robin: Trophy,
  social: Sparkles, other: CalendarDays, league: Trophy,
};

export function EventDateBadge({ start, end, timeZone }: { start: string | null; end?: string | null; timeZone?: string | null }) {
  const date = eventSchedule(start, end, timeZone);
  return date ? <time dateTime={start!} aria-label={date.label} className="venue-event-date">
    <span className="text-[11px] font-semibold uppercase tracking-[.14em]">{date.weekday}</span>
    <span className="my-1 text-[30px] font-bold leading-none tracking-tight tabular-nums sm:text-[34px]">{date.day}</span>
    <span className="text-[10px] font-semibold uppercase tracking-wide">{date.month} {date.year}</span>
  </time> : <span className="venue-event-date gap-2"><Trophy aria-hidden className="h-6 w-6" /><span className="text-xs font-semibold">Season</span></span>;
}

export function VenueEventCard({ event, timeZone, going, viewerRsvp, venueName, onPick }: {
  event: VenueCardEvent; timeZone?: string | null; going?: number | null; viewerRsvp?: string | null;
  venueName?: string | null; onPick?: (id: string) => void;
}) {
  const format = event.event_format ?? 'other';
  const Icon = EVENT_ICONS[format] ?? CalendarDays;
  const schedule = eventSchedule(event.start_time, event.end_time, timeZone);
  const phase = event.start_time ? programPhase({ start_time: event.start_time, end_time: event.end_time }) : 'upcoming';
  const left = event.capacity != null && going != null ? Math.max(0, event.capacity - going) : null;
  const status = phase === 'ended' ? 'Ended' : viewerRsvp === 'going' ? "You're in" : viewerRsvp === 'waitlist' ? 'Waitlisted'
    : viewerRsvp === 'maybe' ? 'Maybe' : left === 0 ? 'Full · View options' : left != null ? `${left} spot${left === 1 ? '' : 's'} left` : format === 'league' ? 'View season' : 'View availability';
  const skill = event.skill_level_min != null && event.skill_level_max != null ? `${clubSkill(event.skill_level_min)}–${clubSkill(event.skill_level_max)}`
    : event.skill_level_min != null ? `${clubSkill(event.skill_level_min)}+` : event.skill_level_max != null ? `Up to ${clubSkill(event.skill_level_max)}` : 'All levels';
  const Row = onPick ? 'button' : 'div';
  return <Row {...(onPick ? { type: 'button' as const, onClick: () => onPick(event.id) } : {})}
    data-venue-service={programService(format)} data-event-format={format}
    className={cn('venue-event-card group w-full overflow-hidden rounded-[20px] border bg-card text-left', onPick && 'venue-interactive', phase === 'ended' && 'venue-event-ended')}>
    <div className="grid grid-cols-[64px_minmax(0,1fr)] gap-3 p-4 sm:grid-cols-[76px_minmax(0,1fr)] sm:gap-4 sm:p-5">
      <EventDateBadge start={event.start_time} end={event.end_time} timeZone={timeZone} />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="venue-event-type"><Icon aria-hidden className="h-3.5 w-3.5" />{EVENT_LABELS[format] ?? 'Venue Event'}</span>
          {phase === 'live' && <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">In progress</span>}
        </div>
        <h3 className="mt-2.5 break-words text-base font-semibold leading-snug tracking-tight [overflow-wrap:anywhere] sm:text-lg">{event.title}</h3>
        {schedule ? <p className="mt-2 flex items-start gap-1.5 text-[13px] font-semibold leading-5 tabular-nums sm:text-sm">
          <Clock3 aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><span>{schedule.time}{schedule.zone && <span className="ml-1 text-xs font-normal text-muted-foreground"> {schedule.zone}</span>}</span>
        </p> : <p className="mt-2 text-sm text-muted-foreground">Active league · View season details</p>}
        {event.description && <p className="mt-2 line-clamp-2 break-words text-[13px] leading-5 text-muted-foreground">{event.description}</p>}
      </div>
    </div>
    <div className="venue-event-footer flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3 sm:px-5">
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs leading-5 text-muted-foreground">
        {format !== 'league' && <span>{skill}</span>}
        {event.capacity != null && going != null && <span className="inline-flex items-center gap-1.5 tabular-nums"><Users aria-hidden className="h-3.5 w-3.5" />{going} / {event.capacity} players</span>}
        {event.rr_courts != null && event.rr_courts > 0 && <span className="inline-flex items-center gap-1"><LayoutGrid aria-hidden className="h-3.5 w-3.5" />{event.rr_courts} court{event.rr_courts === 1 ? '' : 's'}</span>}
        {venueName && <span>{venueName}</span>}
      </span>
      <span className={cn('inline-flex items-center gap-1.5 text-xs font-semibold', viewerRsvp === 'going' ? 'text-emerald-700 dark:text-emerald-300' : left != null && left > 0 && left <= 5 ? 'text-amber-800 dark:text-amber-200' : 'text-foreground')}>
        {viewerRsvp === 'going' && <Check aria-hidden className="h-3.5 w-3.5" />}{status}{onPick && <ChevronRight aria-hidden className="h-4 w-4 shrink-0" />}
      </span>
    </div>
  </Row>;
}
