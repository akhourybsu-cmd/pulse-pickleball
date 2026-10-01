import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { format } from 'date-fns';
import { AlertCircle } from 'lucide-react';
import { RECURRING_OPTIONS, type RecurringFrequency } from '../types';
import { Button } from '@/components/ui/button';
import { clockMinutes, endAfterDuration } from '@/lib/venues/programScheduling';
import { venueCalendarNow } from '@/lib/venues/timezone';

interface EventDateTimeStepProps {
  date: string;
  startTime: string;
  endTime: string;
  recurringFrequency: RecurringFrequency;
  recurringCount: number;
  onDateChange: (date: string) => void;
  onStartTimeChange: (time: string) => void;
  onEndTimeChange: (time: string) => void;
  onRecurringFrequencyChange: (freq: RecurringFrequency) => void;
  onRecurringCountChange: (count: number) => void;
  venueMode?: boolean;
  timeZone?: string | null;
}

const COUNT_OPTIONS = [2, 4, 6, 8, 10, 12];

export function EventDateTimeStep({
  date,
  startTime,
  endTime,
  recurringFrequency,
  recurringCount,
  onDateChange,
  onStartTimeChange,
  onEndTimeChange,
  onRecurringFrequencyChange,
  onRecurringCountChange,
  venueMode = false,
  timeZone,
}: EventDateTimeStepProps) {
  const today = format(venueCalendarNow(timeZone), 'yyyy-MM-dd');
  const isRecurring = recurringFrequency !== 'none';
  const invalidWindow = !!startTime && !!endTime && endTime <= startTime;

  const setDuration = (minutes: number) => {
    onEndTimeChange(endAfterDuration(startTime, minutes));
  };
  const duration = clockMinutes(endTime) - clockMinutes(startTime);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">When is it?</h3>
        {venueMode && (
          <p className="mt-1 text-[13px] text-muted-foreground">
            Set the full court window. Repeating programs create independently manageable dates.
            {timeZone && ` Times are in ${timeZone.replace(/_/g, ' ')}.`}
          </p>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <Label htmlFor="event-date" className="text-xs text-muted-foreground mb-1 block">Date</Label>
          <Input
            id="event-date"
            type="date"
            value={date}
            onChange={(e) => onDateChange(e.target.value)}
            min={today}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="event-start" className="text-xs text-muted-foreground mb-1 block">Start time</Label>
            <Input
              id="event-start"
              type="time"
              value={startTime}
              onChange={(e) => onStartTimeChange(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="event-end" className="text-xs text-muted-foreground mb-1 block">
              End time {venueMode ? '' : '(optional)'}
            </Label>
            <Input
              id="event-end"
              type="time"
              value={endTime}
              onChange={(e) => onEndTimeChange(e.target.value)}
            />
          </div>
        </div>

        {venueMode && (
          <div>
            <Label htmlFor="event-duration" className="mb-1 block text-sm">How long is the event? (minutes)</Label>
            <Input id="event-duration" type="number" min={1} max={1439} step={1} required disabled={!startTime}
              placeholder="Choose a duration" value={Number.isFinite(duration) && duration > 0 ? duration : ''}
              onChange={event => setDuration(Number(event.target.value))} />
            <p className="mt-1 text-xs text-muted-foreground">Courts are reserved for the entire duration. Include any setup and cleanup time.</p>
          </div>
        )}
        {venueMode && startTime && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Duration
            </span>
            {[60, 90, 120, 180].map((minutes) => (
              <Button
                key={minutes}
                type="button"
                variant="outline"
                size="sm"
                className="h-7 rounded-full px-2.5 text-[11px]"
                disabled={!endAfterDuration(startTime, minutes)}
                onClick={() => setDuration(minutes)}
              >
                {minutes < 60 ? `${minutes}m` : minutes % 60 ? `${Math.floor(minutes / 60)}h 30m` : `${minutes / 60}h`}
              </Button>
            ))}
          </div>
        )}
        {invalidWindow && (
          <p className="flex items-center gap-1.5 rounded-xl border border-destructive/25 bg-destructive/[0.06] px-3 py-2 text-[11px] font-medium text-destructive">
            <AlertCircle className="h-3.5 w-3.5" />
            End time must be later than the start time.
          </p>
        )}
      </div>

      {/* Recurring section — defaults to "Does not repeat" so the
          single-event flow stays a one-glance task. Picking a cadence
          reveals the occurrence-count dropdown below. */}
      <div className="space-y-3 pt-2 border-t border-border/40">
        <div>
          <Label htmlFor="event-repeat" className="text-xs text-muted-foreground mb-1 block">Repeats</Label>
          <Select
            value={recurringFrequency}
            onValueChange={(v) => onRecurringFrequencyChange(v as RecurringFrequency)}
          >
            <SelectTrigger id="event-repeat">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RECURRING_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  <div className="flex flex-col items-start">
                    <span>{opt.label}</span>
                    <span className="text-[11px] text-muted-foreground">{opt.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isRecurring && (
          <div>
            <Label htmlFor="event-repeat-count" className="text-xs text-muted-foreground mb-1 block">
              How many occurrences? (including the first)
            </Label>
            <Select
              value={String(recurringCount)}
              onValueChange={(v) => onRecurringCountChange(parseInt(v, 10))}
            >
              <SelectTrigger id="event-repeat-count">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COUNT_OPTIONS.map((n) => (
                  <SelectItem key={n} value={String(n)}>{n} occurrences</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              Each occurrence is created as its own event, individually RSVP-able and deletable.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
