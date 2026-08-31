import { Calendar, Clock, MapPin, Users, Repeat, ListOrdered, LayoutGrid } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import {
  EventWizardFormData,
  EVENT_TYPE_OPTIONS,
  RECURRING_OPTIONS,
  generateOccurrenceStarts,
} from '../types';

interface EventReviewStepProps {
  formData: EventWizardFormData;
}

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5">
      <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-primary/80" />
        {label}
      </span>
      <span className="min-w-0 truncate text-right text-[13px] font-semibold">{value}</span>
    </div>
  );
}

export function EventReviewStep({ formData }: EventReviewStepProps) {
  const eventType = EVENT_TYPE_OPTIONS.find((t) => t.value === formData.eventType);
  const recurring = RECURRING_OPTIONS.find((r) => r.value === formData.recurringFrequency);
  const isRecurring = formData.recurringFrequency !== 'none';

  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'EEE, MMM d, yyyy');
    } catch {
      return dateStr;
    }
  };

  const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${minutes} ${ampm}`;
  };

  const lastOccurrence = (() => {
    if (!isRecurring || !formData.date || !formData.startTime) return null;
    const starts = generateOccurrenceStarts(
      new Date(`${formData.date}T${formData.startTime}`),
      formData.recurringFrequency,
      formData.recurringCount,
    );
    return starts[starts.length - 1];
  })();

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-primary/25 bg-primary/[0.06] p-3">
        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary/80">
          {eventType?.label ?? 'Event'}
        </div>
        <h4 className="mt-0.5 text-[18px] font-extrabold leading-tight tracking-[-0.01em]">
          {formData.title || 'Untitled event'}
        </h4>
        {formData.description && (
          <p className="mt-1 text-[12.5px] leading-snug text-muted-foreground">
            {formData.description}
          </p>
        )}
      </div>

      <div className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/70 bg-card/70">
        <Row icon={Calendar} label="Date" value={formatDate(formData.date)} />
        <Row
          icon={Clock}
          label="Time"
          value={
            formData.endTime
              ? `${formatTime(formData.startTime)} – ${formatTime(formData.endTime)}`
              : formatTime(formData.startTime)
          }
        />
        {formData.location && <Row icon={MapPin} label="Where" value={formData.location} />}
        {formData.eventType === 'round_robin' && (formData.rrCourts || formData.rrGamesPerPlayer) && (
          <Row
            icon={LayoutGrid}
            label="Format"
            value={[
              formData.rrCourts ? `${formData.rrCourts} courts` : null,
              formData.rrGamesPerPlayer ? `${formData.rrGamesPerPlayer} games each` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          />
        )}
        <Row
          icon={Users}
          label="Capacity"
          value={formData.capacity ? `${formData.capacity} players` : 'Unlimited'}
        />
        {!!formData.capacity && (
          <Row
            icon={ListOrdered}
            label="Waitlist"
            value={
              formData.waitlistEnabled
                ? formData.waitlistLimit
                  ? `On · cap ${formData.waitlistLimit}`
                  : 'On · unlimited'
                : 'Off'
            }
          />
        )}
        <Row
          icon={Repeat}
          label="Repeats"
          value={
            isRecurring
              ? `${recurring?.label} · ${formData.recurringCount}x`
              : 'One-time event'
          }
        />
      </div>

      {isRecurring && lastOccurrence && (
        <p className="text-[11px] leading-snug text-muted-foreground">
          {formData.recurringCount} occurrences will be created, running through{' '}
          <span className="font-semibold text-foreground">
            {format(lastOccurrence, 'EEE, MMM d, yyyy')}
          </span>
          . Each one is RSVP-able and deletable on its own.
        </p>
      )}
    </div>
  );
}
