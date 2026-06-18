import { CalendarClock } from 'lucide-react';
import { addDays, format } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface EventDateTimeStepProps {
  date: string;
  startTime: string;
  endTime: string;
  onDateChange: (date: string) => void;
  onStartTimeChange: (time: string) => void;
  onEndTimeChange: (time: string) => void;
}

// Quick-pick date chips — the recreational organizer almost always
// picks one of these. Keyboard-friendly fallback below.
const dateQuickPicks = (today: Date) => [
  { label: 'Today',       date: today,           sub: format(today,              'EEE') },
  { label: 'Tomorrow',    date: addDays(today,1),sub: format(addDays(today, 1),  'EEE') },
  { label: 'In a week',   date: addDays(today,7),sub: format(addDays(today, 7),  'EEE · MMM d') },
];

// Common time chips for a pickleball crew.
const TIME_QUICK_PICKS = [
  { label: '6:00 AM',  value: '06:00' },
  { label: '9:00 AM',  value: '09:00' },
  { label: '12:00 PM', value: '12:00' },
  { label: '5:30 PM',  value: '17:30' },
  { label: '7:00 PM',  value: '19:00' },
  { label: '8:30 PM',  value: '20:30' },
];

export function EventDateTimeStep({
  date,
  startTime,
  endTime,
  onDateChange,
  onStartTimeChange,
  onEndTimeChange,
}: EventDateTimeStepProps) {
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  const quickPicks = dateQuickPicks(today);

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary flex-shrink-0">
          <CalendarClock className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h3 className="text-lg font-semibold leading-tight">When is it?</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Tap a quick chip or pick a custom date.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Quick date chips */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Date</Label>
          <div className="grid grid-cols-3 gap-2">
            {quickPicks.map((p) => {
              const v = format(p.date, 'yyyy-MM-dd');
              const active = date === v;
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => onDateChange(v)}
                  className={cn(
                    'rounded-lg border-2 px-2.5 py-2 text-left transition-all duration-150 active:scale-[0.98]',
                    active
                      ? 'border-primary bg-primary/10'
                      : 'border-border/60 hover:border-primary/40 hover:bg-muted/40',
                  )}
                >
                  <div className="text-xs font-semibold">{p.label}</div>
                  <div className="text-[10px] text-muted-foreground">{p.sub}</div>
                </button>
              );
            })}
          </div>
          <Input
            type="date"
            value={date}
            onChange={(e) => onDateChange(e.target.value)}
            min={todayStr}
            className="mt-1"
          />
        </div>

        {/* Time chips + custom inputs */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Start time</Label>
          <div className="grid grid-cols-3 gap-1.5">
            {TIME_QUICK_PICKS.map((t) => {
              const active = startTime === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => onStartTimeChange(t.value)}
                  className={cn(
                    'rounded-md border px-2 py-1.5 text-xs font-medium transition-all duration-150 active:scale-[0.98] tabular-nums',
                    active
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border/60 hover:border-primary/40 hover:bg-muted/40',
                  )}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
          <Input
            type="time"
            value={startTime}
            onChange={(e) => onStartTimeChange(e.target.value)}
            className="mt-1"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium">
            End time <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Input
            type="time"
            value={endTime}
            onChange={(e) => onEndTimeChange(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
