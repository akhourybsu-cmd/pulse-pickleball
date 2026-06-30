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
import { RECURRING_OPTIONS, type RecurringFrequency } from '../types';

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
}: EventDateTimeStepProps) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const isRecurring = recurringFrequency !== 'none';

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">When is it?</h3>

      <div className="space-y-3">
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Date</Label>
          <Input
            type="date"
            value={date}
            onChange={(e) => onDateChange(e.target.value)}
            min={today}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Start time</Label>
            <Input
              type="time"
              value={startTime}
              onChange={(e) => onStartTimeChange(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">End time (optional)</Label>
            <Input
              type="time"
              value={endTime}
              onChange={(e) => onEndTimeChange(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Recurring section — defaults to "Does not repeat" so the
          single-event flow stays a one-glance task. Picking a cadence
          reveals the occurrence-count dropdown below. */}
      <div className="space-y-3 pt-2 border-t border-border/40">
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Repeats</Label>
          <Select
            value={recurringFrequency}
            onValueChange={(v) => onRecurringFrequencyChange(v as RecurringFrequency)}
          >
            <SelectTrigger>
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
            <Label className="text-xs text-muted-foreground mb-1 block">
              How many occurrences? (including the first)
            </Label>
            <Select
              value={String(recurringCount)}
              onValueChange={(v) => onRecurringCountChange(parseInt(v, 10))}
            >
              <SelectTrigger>
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
