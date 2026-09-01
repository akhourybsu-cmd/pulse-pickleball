import { useMemo, useState } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Check,
  HelpCircle,
  X,
  Plus,
  Trash2,
  List,
  CalendarDays,
  Repeat,
  Settings2,
  ListOrdered,
} from 'lucide-react';
import {
  format,
  isSameDay,
  isToday,
  isTomorrow,
  isPast,
  parseISO,
  differenceInCalendarDays,
} from 'date-fns';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { GroupEmptyState } from './GroupEmptyState';
import { EventWizardContainer } from './event-wizard/EventWizardContainer';
import { GroupScheduleCalendar } from './GroupScheduleCalendar';
import { useGroupEvents, type GroupEvent } from '@/hooks/useGroupEvents';
import { useGroupSettings } from '@/hooks/useGroupSettings';
import { EventSettingsDialog } from './EventSettingsDialog';
import { EVENT_TYPE_OPTIONS } from './event-wizard/types';
import { cn } from '@/lib/utils';

interface GroupScheduleProps {
  groupId: string;
  isAdmin: boolean;
  currentUserId: string | null;
}

/** Bucket label for a start date — drives the sticky section headers. */
function bucketOf(date: Date): 'past' | 'today' | 'tomorrow' | 'week' | 'later' {
  if (isToday(date)) return 'today';
  if (isPast(date)) return 'past';
  if (isTomorrow(date)) return 'tomorrow';
  if (differenceInCalendarDays(date, new Date()) <= 7) return 'week';
  return 'later';
}

const BUCKET_LABEL: Record<string, string> = {
  today: 'Today',
  tomorrow: 'Tomorrow',
  week: 'This week',
  later: 'Later',
  past: 'Past',
};

const BUCKET_ORDER = ['today', 'tomorrow', 'week', 'later', 'past'] as const;

export function GroupSchedule({ groupId, isAdmin, currentUserId }: GroupScheduleProps) {
  const { events, loading, deleteEvent, updateRsvp, updateEvent } = useGroupEvents(groupId);
  const { settings } = useGroupSettings(groupId);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [settingsEvent, setSettingsEvent] = useState<GroupEvent | null>(null);
  // Non-admin members can only schedule when the group allows it.
  const canCreate = isAdmin || settings.allow_member_events !== false;
  // View toggle — list (default, "what's next") vs month (glanceable
  // calendar with day dots; tapping a day filters the list to that day).
  const [view, setView] = useState<'list' | 'month'>('list');
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  // When filtering by day-of-selection, the list below only shows events
  // on that day. Otherwise show everything in chronological order.
  const visibleEvents = useMemo(() => {
    if (!selectedDay) return events;
    return events.filter((e) => isSameDay(parseISO(e.start_time), selectedDay));
  }, [events, selectedDay]);

  // Group into Today / Tomorrow / This week / Later / Past so scanning a long
  // calendar is a glance instead of a read. When a day filter is active the
  // grouping is skipped (a single day needs no headers).
  const grouped = useMemo(() => {
    if (selectedDay) return [{ key: 'day', label: '', items: visibleEvents }];
    const buckets = new Map<string, GroupEvent[]>();
    visibleEvents.forEach((e) => {
      const k = bucketOf(parseISO(e.start_time));
      buckets.set(k, [...(buckets.get(k) ?? []), e]);
    });
    return BUCKET_ORDER.filter((k) => buckets.get(k)?.length).map((k) => ({
      key: k,
      label: BUCKET_LABEL[k],
      items: buckets.get(k)!,
    }));
  }, [visibleEvents, selectedDay]);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-12 w-full rounded-2xl" />
        <Skeleton className="h-9 w-48 rounded-full" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Create Event Wizard or CTA */}
      {wizardOpen ? (
        <EventWizardContainer
          groupId={groupId}
          onClose={() => setWizardOpen(false)}
          onSuccess={() => setWizardOpen(false)}
        />
      ) : canCreate ? (
        <Button
          onClick={() => setWizardOpen(true)}
          className="h-12 w-full gap-2 rounded-2xl font-bold tracking-wide shadow-[0_10px_30px_-16px_hsl(var(--primary)/0.9)]"
        >
          <Plus className="h-4 w-4" />
          Create Event
        </Button>
      ) : null}

      {/* Sticky toolbar — view switch + live count. Stays reachable while
          scrolling a long schedule. */}
      {!wizardOpen && events.length > 0 && (
        <div className="sticky top-0 z-10 -mx-1 px-1 py-1.5 bg-background/85 backdrop-blur-md">
          <div className="flex items-center justify-between gap-2">
            <div className="relative inline-flex items-center rounded-full border border-border/60 bg-card/80 p-0.5 text-xs backdrop-blur-sm shadow-[0_2px_14px_-10px_hsl(var(--foreground)/0.4)]">
              {(
                [
                  { id: 'list' as const, label: 'List', icon: List },
                  { id: 'month' as const, label: 'Month', icon: CalendarDays },
                ]
              ).map(({ id, label, icon: Icon }) => {
                const active = view === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setView(id);
                      if (id === 'list') setSelectedDay(null);
                    }}
                    className="relative flex items-center gap-1.5 rounded-full px-3 py-1.5 font-semibold transition-colors"
                  >
                    {active && (
                      <motion.span
                        layoutId="schedule-view-pill"
                        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                        className="absolute inset-0 rounded-full bg-primary shadow-[0_4px_14px_-6px_hsl(var(--primary)/0.9)]"
                      />
                    )}
                    <Icon
                      className={cn(
                        'relative h-3 w-3',
                        active ? 'text-primary-foreground' : 'text-muted-foreground',
                      )}
                    />
                    <span
                      className={cn(
                        'relative',
                        active ? 'text-primary-foreground' : 'text-muted-foreground',
                      )}
                    >
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>
            <span className="rounded-full border border-border/50 bg-card/70 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-muted-foreground">
              {visibleEvents.length} {visibleEvents.length === 1 ? 'event' : 'events'}
            </span>
          </div>
        </div>
      )}

      {/* Month calendar (only in month view). The calendar drives selectedDay,
          which filters the list below. */}
      {!wizardOpen && view === 'month' && events.length > 0 && (
        <GroupScheduleCalendar
          events={events.map((e) => ({ id: e.id, start_time: e.start_time, title: e.title }))}
          selectedDate={selectedDay}
          onSelectDate={setSelectedDay}
        />
      )}

      {/* Events List */}
      {events.length === 0 && !wizardOpen ? (
        <GroupEmptyState
          icon={Calendar}
          title="No upcoming events"
          description="Schedule a session, round robin, or open play for your group."
          actions={
            canCreate
              ? [{ label: 'Create Event', onClick: () => setWizardOpen(true), icon: Plus }]
              : []
          }
          size="sm"
        />
      ) : visibleEvents.length === 0 && selectedDay ? (
        <GroupEmptyState
          icon={Calendar}
          title={`Nothing on ${format(selectedDay, 'EEE, MMM d')}`}
          description="Tap another day on the calendar or clear the filter."
          variant="compact"
          size="sm"
        />
      ) : (
        <div className="space-y-5">
          {grouped.map((section) => (
            <div key={section.key} className="space-y-2.5">
              {section.label && (
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                    {section.label}
                  </span>
                  <span className="h-px flex-1 bg-gradient-to-r from-border/70 to-transparent" />
                  <span className="text-[11px] font-semibold tabular-nums text-muted-foreground/70">
                    {section.items.length}
                  </span>
                </div>
              )}

              {section.items.map((event, idx) => {
                const startDate = new Date(event.start_time);
                const endDate = event.end_time ? new Date(event.end_time) : null;
                const isCreator = currentUserId === event.created_by;
                const totalGoing = event.rsvps?.going || 0;
                const waitlistCount = event.rsvps?.waitlist || 0;
                const isFull = event.capacity ? totalGoing >= event.capacity : false;
                const waitlistFull =
                  event.waitlist_limit != null ? waitlistCount >= event.waitlist_limit : false;
                const canJoinWaitlist = isFull && event.waitlist_enabled && !waitlistFull;
                const formatMeta = EVENT_TYPE_OPTIONS.find((o) => o.value === event.event_format);
                const goingLabel =
                  event.user_rsvp === 'waitlist'
                    ? 'Waitlisted'
                    : canJoinWaitlist
                      ? 'Join waitlist'
                      : 'Going';
                const live = isToday(startDate);
                const past = isPast(startDate) && !live;
                const fillPct =
                  event.capacity && event.capacity > 0
                    ? Math.min(100, Math.round((totalGoing / event.capacity) * 100))
                    : null;

                return (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: Math.min(idx * 0.03, 0.15) }}
                    className={cn(
                      'group relative overflow-hidden rounded-2xl border bg-card/70 backdrop-blur-sm',
                      'shadow-[0_10px_34px_-24px_hsl(var(--foreground)/0.5)] transition-colors',
                      live ? 'border-primary/45' : 'border-border/60',
                      past && 'opacity-70',
                    )}
                  >
                    {/* Accent edge — emerald for today's sessions */}
                    <span
                      className={cn(
                        'absolute inset-y-0 left-0 w-[3px]',
                        live ? 'bg-primary' : 'bg-border/70',
                      )}
                    />

                    <div className="flex gap-3 p-3.5 pl-4 sm:gap-4 sm:p-4 sm:pl-5">
                      {/* Date rail */}
                      <div
                        className={cn(
                          'flex h-14 w-14 flex-shrink-0 flex-col items-center justify-center rounded-xl border',
                          live
                            ? 'border-primary/40 bg-primary/10 text-primary'
                            : 'border-border/60 bg-muted/50 text-foreground',
                        )}
                      >
                        <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">
                          {format(startDate, 'MMM')}
                        </span>
                        <span className="text-xl font-extrabold leading-none tabular-nums">
                          {format(startDate, 'd')}
                        </span>
                        <span className="text-[9px] font-semibold uppercase tracking-wide opacity-70">
                          {format(startDate, 'EEE')}
                        </span>
                      </div>

                      {/* Body */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="min-w-0 flex-1 truncate text-base font-bold leading-snug tracking-tight">
                            {event.title}
                          </h3>
                          {(isCreator || isAdmin) && (
                            <div className="flex flex-shrink-0 items-center gap-0.5">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                aria-label="Event settings"
                                onClick={() => setSettingsEvent(event)}
                              >
                                <Settings2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                aria-label="Delete event"
                                onClick={() => deleteEvent(event.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>

                        {/* Chips */}
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          {formatMeta && (
                            <span className="inline-flex items-center rounded-full border border-border/60 bg-muted/50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                              {formatMeta.label}
                            </span>
                          )}
                          {event.is_recurring && (
                            <span
                              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary"
                              aria-label={
                                event.recurring_rule
                                  ? `Recurring · ${event.recurring_rule}`
                                  : 'Recurring event'
                              }
                            >
                              <Repeat className="h-3 w-3" />
                              Recurring
                            </span>
                          )}
                          {isFull && (
                            <span className="inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                              Full
                            </span>
                          )}
                          {live && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
                              <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground/90 animate-pulse" />
                              Today
                            </span>
                          )}
                        </div>

                        {/* Meta */}
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {format(startDate, 'h:mm a')}
                            {endDate && ` – ${format(endDate, 'h:mm a')}`}
                          </span>
                          {event.custom_location && (
                            <span className="flex min-w-0 items-center gap-1">
                              <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                              <span className="truncate">{event.custom_location}</span>
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Users className="h-3.5 w-3.5" />
                            <span className="font-semibold text-foreground tabular-nums">
                              {totalGoing}
                            </span>
                            {event.capacity ? `/ ${event.capacity}` : ''} going
                          </span>
                          {event.rsvps?.maybe ? <span>{event.rsvps.maybe} maybe</span> : null}
                          {waitlistCount > 0 && (
                            <span className="flex items-center gap-1">
                              <ListOrdered className="h-3.5 w-3.5" />
                              <span className="tabular-nums">{waitlistCount}</span> waiting
                            </span>
                          )}
                        </div>

                        {event.description && (
                          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground/90">
                            {event.description}
                          </p>
                        )}

                        {/* Capacity meter */}
                        {fillPct != null && (
                          <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className={cn(
                                'h-full rounded-full transition-all',
                                isFull ? 'bg-amber-500' : 'bg-primary',
                              )}
                              style={{ width: `${fillPct}%` }}
                            />
                          </div>
                        )}

                        {/* RSVP segmented control */}
                        <div className="mt-3 grid grid-cols-3 gap-1.5 rounded-xl border border-border/50 bg-muted/30 p-1">
                          <Button
                            variant={
                              event.user_rsvp === 'going' || event.user_rsvp === 'waitlist'
                                ? 'default'
                                : 'ghost'
                            }
                            size="sm"
                            className="h-9 gap-1.5 rounded-lg px-2 text-xs font-semibold"
                            onClick={() => updateRsvp(event.id, 'going')}
                            disabled={
                              isFull &&
                              event.user_rsvp !== 'going' &&
                              event.user_rsvp !== 'waitlist' &&
                              !canJoinWaitlist
                            }
                          >
                            {event.user_rsvp === 'waitlist' ? (
                              <ListOrdered className="h-4 w-4 flex-shrink-0" />
                            ) : (
                              <Check className="h-4 w-4 flex-shrink-0" />
                            )}
                            <span className="truncate">{goingLabel}</span>
                          </Button>
                          <Button
                            variant={event.user_rsvp === 'maybe' ? 'default' : 'ghost'}
                            size="sm"
                            className="h-9 gap-1.5 rounded-lg px-2 text-xs font-semibold"
                            onClick={() => updateRsvp(event.id, 'maybe')}
                          >
                            <HelpCircle className="h-4 w-4 flex-shrink-0" />
                            <span className="truncate">Maybe</span>
                          </Button>
                          <Button
                            variant={event.user_rsvp === 'not_going' ? 'default' : 'ghost'}
                            size="sm"
                            className="h-9 gap-1.5 rounded-lg px-2 text-xs font-semibold"
                            onClick={() => updateRsvp(event.id, 'not_going')}
                          >
                            <X className="h-4 w-4 flex-shrink-0" />
                            <span className="truncate">Can't go</span>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      <EventSettingsDialog
        event={settingsEvent}
        open={!!settingsEvent}
        onOpenChange={(open) => !open && setSettingsEvent(null)}
        onSave={(updates) => updateEvent({ eventId: settingsEvent!.id, updates })}
      />
    </div>
  );
}
