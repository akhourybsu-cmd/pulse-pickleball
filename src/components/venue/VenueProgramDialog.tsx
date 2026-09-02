import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import {
  CalendarDays,
  Check,
  Clock3,
  Gauge,
  HelpCircle,
  LayoutGrid,
  MapPin,
  Shuffle,
  Users,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { GroupEvent, GroupRsvpStatus } from '@/hooks/useGroupEvents';
import { cn } from '@/lib/utils';

const FORMAT_LABEL: Record<string, string> = {
  open_play: 'Open Play',
  clinic: 'Clinic',
  practice: 'Practice',
  round_robin: 'Round Robin',
  social: 'Social',
  other: 'Venue Event',
};

const ROTATION_LABEL: Record<string, string> = {
  paddle_stack: 'Paddle stack',
  timed_rotation: 'Timed rotation',
  winners_stay: 'Winners stay',
  organized_games: 'Organized games',
  coach_led: 'Coach-led',
};

type RsvpChoice = 'going' | 'maybe' | 'not_going';

interface VenueProgramDialogProps {
  event: GroupEvent | null;
  venueName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canRsvp: boolean;
  accent?: string | null;
  onRsvp: (eventId: string, status: RsvpChoice) => Promise<GroupRsvpStatus | void> | GroupRsvpStatus | void;
}

/** Player-facing program details and registration in one focused surface. */
export function VenueProgramDialog({
  event,
  venueName,
  open,
  onOpenChange,
  canRsvp,
  accent,
  onRsvp,
}: VenueProgramDialogProps) {
  const [saving, setSaving] = useState<RsvpChoice | null>(null);
  const [viewerRsvp, setViewerRsvp] = useState<GroupRsvpStatus | null>(event?.user_rsvp ?? null);

  useEffect(() => {
    setViewerRsvp(event?.user_rsvp ?? null);
  }, [event?.id, event?.user_rsvp]);

  if (!event) return null;

  const start = parseISO(event.start_time);
  const end = event.end_time ? parseISO(event.end_time) : null;
  const going = event.rsvps?.going ?? 0;
  const spotsLeft = event.capacity == null ? null : Math.max(0, event.capacity - going);
  const fillPercent = event.capacity ? Math.min(100, Math.round((going / event.capacity) * 100)) : null;
  const isFull = spotsLeft === 0;
  const skill =
    event.skill_level_min != null && event.skill_level_max != null
      ? `${event.skill_level_min.toFixed(1)}–${event.skill_level_max.toFixed(1)}`
      : event.skill_level_min != null
        ? `${event.skill_level_min.toFixed(1)}+`
        : event.skill_level_max != null
          ? `Up to ${event.skill_level_max.toFixed(1)}`
          : 'All levels';

  const choose = async (status: RsvpChoice) => {
    setSaving(status);
    try {
      const finalStatus = await onRsvp(event.id, status);
      setViewerRsvp(finalStatus ?? status);
    } finally {
      setSaving(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bottom-0 left-0 top-auto max-h-[94dvh] w-full max-w-none translate-x-0 translate-y-0 overflow-y-auto overscroll-contain rounded-b-none rounded-t-[26px] border-border/80 p-0 sm:bottom-auto sm:left-[50%] sm:top-[50%] sm:max-h-[88dvh] sm:max-w-[680px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[26px] [&>button]:right-4 [&>button]:top-4 [&>button]:z-20 [&>button]:rounded-full [&>button]:border [&>button]:border-white/15 [&>button]:bg-black/20 [&>button]:p-2 [&>button]:text-white [&>button]:opacity-100 [&>button]:backdrop-blur-md">
        <DialogHeader className="sr-only">
          <DialogTitle>{event.title}</DialogTitle>
          <DialogDescription>Program information and RSVP options.</DialogDescription>
        </DialogHeader>

        <div
          className="relative overflow-hidden px-5 pb-5 pt-6 text-white sm:px-7 sm:pb-6 sm:pt-7"
          style={{
            background: accent
              ? `linear-gradient(135deg, color-mix(in srgb, ${accent} 78%, #14171b), #17191d 72%)`
              : 'linear-gradient(135deg, hsl(var(--primary)), #17191d 72%)',
          }}
        >
          <div aria-hidden className="absolute inset-0 opacity-15 [background-image:linear-gradient(115deg,transparent_0%,transparent_48%,white_49%,white_50%,transparent_51%)] [background-size:26px_26px]" />
          <div className="relative pr-10">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-white/20 bg-white/12 text-[9px] font-bold uppercase tracking-[0.15em] text-white hover:bg-white/12">
                {FORMAT_LABEL[event.event_format] ?? 'Venue program'}
              </Badge>
              {viewerRsvp === 'going' && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-200">
                  <Check className="h-3.5 w-3.5" /> You’re in
                </span>
              )}
              {viewerRsvp === 'waitlist' && (
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-amber-200">Waitlisted</span>
              )}
            </div>
            <h2 className="mt-3 text-2xl font-extrabold leading-tight tracking-[-0.025em] sm:text-[30px]">
              {event.title}
            </h2>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-medium text-white/75">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" />
                {format(start, 'EEEE, MMMM d')}
              </span>
              <span className="inline-flex items-center gap-1.5 tabular-nums">
                <Clock3 className="h-3.5 w-3.5" />
                {format(start, 'h:mm a')}{end ? ` – ${format(end, 'h:mm a')}` : ''}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-5 p-5 sm:p-7">
          {event.description && (
            <p className="text-sm leading-6 text-foreground/80">{event.description}</p>
          )}

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <ProgramFact icon={MapPin} label="Venue" value={venueName} />
            <ProgramFact icon={Gauge} label="Player level" value={skill} />
            <ProgramFact
              icon={Users}
              label="Registration"
              value={event.capacity ? `${going} of ${event.capacity}` : `${going} going`}
            />
            {event.rr_courts != null && event.rr_courts > 0 && (
              <ProgramFact icon={LayoutGrid} label="Courts" value={String(event.rr_courts)} />
            )}
            {event.rotation_style && ROTATION_LABEL[event.rotation_style] && (
              <ProgramFact icon={Shuffle} label="Rotation" value={ROTATION_LABEL[event.rotation_style]} />
            )}
          </div>

          {fillPercent != null && (
            <div className="rounded-2xl border border-border/70 bg-muted/25 p-3.5">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="font-semibold">Availability</span>
                <span className="font-bold tabular-nums text-foreground/75">
                  {isFull
                    ? event.waitlist_enabled
                      ? 'Waitlist available'
                      : 'Program full'
                    : `${spotsLeft} spot${spotsLeft === 1 ? '' : 's'} left`}
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn('h-full rounded-full bg-primary', isFull && 'bg-amber-500')}
                  style={{ width: `${fillPercent}%`, ...(accent && !isFull ? { backgroundColor: accent } : {}) }}
                />
              </div>
            </div>
          )}

          {canRsvp ? (
            <div className="border-t border-border/70 pt-5">
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <p className="text-sm font-bold">Are you playing?</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">Your response updates the live player count.</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 rounded-2xl border border-border/70 bg-muted/30 p-1.5">
                <RsvpButton
                  icon={Check}
                  label={isFull && event.waitlist_enabled && viewerRsvp !== 'going' ? 'Waitlist' : "I’m in"}
                  selected={viewerRsvp === 'going' || viewerRsvp === 'waitlist'}
                  disabled={!!saving || (isFull && !event.waitlist_enabled && viewerRsvp !== 'going')}
                  onClick={() => void choose('going')}
                />
                <RsvpButton
                  icon={HelpCircle}
                  label="Maybe"
                  selected={viewerRsvp === 'maybe'}
                  disabled={!!saving}
                  onClick={() => void choose('maybe')}
                />
                <RsvpButton
                  icon={X}
                  label="Can’t go"
                  selected={viewerRsvp === 'not_going'}
                  disabled={!!saving}
                  onClick={() => void choose('not_going')}
                />
              </div>
            </div>
          ) : (
            <p className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-3 text-center text-xs text-muted-foreground">
              Join this venue community to register for programs.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ProgramFact({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-border/70 bg-card px-3 py-3">
      <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </span>
      <p className="mt-1.5 truncate text-xs font-bold" title={value}>{value}</p>
    </div>
  );
}

function RsvpButton({
  icon: Icon,
  label,
  selected,
  disabled,
  onClick,
}: {
  icon: typeof Check;
  label: string;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant={selected ? 'default' : 'ghost'}
      className="h-11 min-w-0 gap-1 rounded-xl px-2 text-[11px] font-bold sm:text-xs"
      disabled={disabled}
      onClick={onClick}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{label}</span>
    </Button>
  );
}
