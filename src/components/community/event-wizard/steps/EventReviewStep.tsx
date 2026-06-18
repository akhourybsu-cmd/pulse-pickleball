import { CheckCircle2, Calendar, Clock, MapPin, Users, FileText } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { EventWizardFormData, EVENT_TYPE_OPTIONS } from '../types';

interface EventReviewStepProps {
  formData: EventWizardFormData;
}

export function EventReviewStep({ formData }: EventReviewStepProps) {
  const eventType = EVENT_TYPE_OPTIONS.find((t) => t.value === formData.eventType);

  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'EEEE, MMMM d, yyyy');
    } catch {
      return dateStr;
    }
  };

  const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${minutes} ${ampm}`;
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary flex-shrink-0">
          <CheckCircle2 className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h3 className="text-lg font-semibold leading-tight">Look right?</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Members can RSVP as soon as you create it.
          </p>
        </div>
      </div>

      {/* Hero card — visually mirrors the event card members will see. */}
      <div className="rounded-2xl border border-primary/20 bg-primary/5 overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-primary via-primary to-primary/30" />
        <div className="p-4 space-y-3">
          <div className="flex items-start gap-2.5">
            <span className="text-2xl leading-none mt-0.5">{eventType?.icon ?? '📅'}</span>
            <div className="min-w-0 flex-1">
              <div className="text-base font-semibold leading-tight">
                {formData.title || 'Untitled Event'}
              </div>
              <div className="text-[11px] uppercase tracking-wider font-semibold text-primary mt-0.5">
                {eventType?.label ?? 'Event'}
              </div>
            </div>
          </div>

          {formData.description && (
            <div className="flex items-start gap-2 text-sm text-foreground/80">
              <FileText className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
              <p className="leading-snug line-clamp-3">{formData.description}</p>
            </div>
          )}

          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <span className="font-medium">
              {formData.date ? formatDate(formData.date) : 'No date set'}
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <span className="font-medium tabular-nums">
              {formData.startTime ? formatTime(formData.startTime) : 'No time set'}
              {formData.endTime && ` – ${formatTime(formData.endTime)}`}
            </span>
          </div>

          {formData.location && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <span className="truncate">{formData.location}</span>
            </div>
          )}

          {formData.capacity && (
            <div className="flex items-center gap-2 text-sm">
              <Users className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <span>Capped at {formData.capacity} players</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
