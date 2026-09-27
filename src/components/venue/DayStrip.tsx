import { useEffect, useId, useRef, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { normalizeHex } from '@/lib/venues/branding';
import { contrastInk } from '@/lib/venues/palette';
import { venueCalendarNow } from '@/lib/venues/timezone';
import { parseVenueDay, venueDayKey, venueDayOptions } from '@/lib/venues/navigation';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface DayStripProps {
  value: Date; onChange: (day: Date) => void; days?: number;
  accent?: string | null; timeZone?: string | null; trailing?: React.ReactNode;
}

export function DayStrip({ value, onChange, days = 14, accent, trailing, timeZone }: DayStripProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const inputId = useId();
  const today = venueCalendarNow(timeZone);
  const options = venueDayOptions(value, today, days);
  const color = normalizeHex(accent);
  const selected = venueDayKey(value);
  useEffect(() => {
    const strip = scroller.current, active = activeRef.current;
    if (!strip || !active) return;
    const offset = active.getBoundingClientRect().left - strip.getBoundingClientRect().left;
    strip.scrollTo({ left: strip.scrollLeft + offset - (strip.clientWidth - active.offsetWidth) / 2 });
  }, [selected]);

  return <div className="flex min-w-0 max-w-full items-center gap-2">
    <div ref={scroller} className="scrollbar-hide min-w-0 flex-1 overflow-x-auto py-1" role="group" aria-label="Choose a day">
      <div className="flex min-w-max gap-2">
        {options.map((day, index) => {
          const key = venueDayKey(day), active = key === selected;
          return <button key={key} ref={active ? activeRef : undefined} type="button"
            aria-pressed={active} aria-current={key === venueDayKey(today) ? 'date' : undefined}
            aria-label={(key === venueDayKey(today) ? 'Today, ' : '') + day.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            onClick={() => onChange(day)}
            onKeyDown={event => {
              const next = event.key === 'ArrowRight' ? index + 1 : event.key === 'ArrowLeft' ? index - 1 : event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : -1;
              if (!options[next]) return;
              event.preventDefault(); onChange(options[next]);
              scroller.current?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus();
            }}
            className={cn('flex h-[60px] w-14 shrink-0 flex-col items-center justify-center gap-1 rounded-xl text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary', active ? 'bg-primary font-semibold text-primary-foreground' : 'bg-card text-muted-foreground')}
            style={active && color ? { backgroundColor: color, color: contrastInk(color) } : undefined}>
            <span className="text-[10px] uppercase tracking-wide">{day.toLocaleDateString([], { weekday: 'short' })}</span>
            <span className="text-lg font-semibold tabular-nums">{day.getDate()}</span>
          </button>;
        })}
      </div>
    </div>
    <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
      <PopoverTrigger asChild><button type="button" aria-label="Jump to date" className="club-icon-button rounded-xl border bg-card"><CalendarDays className="h-5 w-5" /></button></PopoverTrigger>
      <PopoverContent align="end" className="w-64 space-y-2">
        <form className="space-y-3" onSubmit={event => {
          event.preventDefault();
          const date = parseVenueDay(String(new FormData(event.currentTarget).get('venueDay')));
          if (date) { onChange(date); setCalendarOpen(false); }
        }}>
          <label htmlFor={inputId} className="text-sm font-semibold">Choose a date</label>
          <input id={inputId} key={selected} name="venueDay" type="date" defaultValue={selected} required className="min-h-11 w-full rounded-xl border bg-background px-3 text-sm" />
          <button type="submit" className="club-primary min-h-11 w-full rounded-xl px-3 text-sm font-semibold">View day</button>
        </form>
        <button type="button" className="club-text-action" onClick={() => { onChange(parseVenueDay(venueDayKey(today))!); setCalendarOpen(false); }}>Back to today</button>
      </PopoverContent>
    </Popover>
    {trailing && <div className="shrink-0">{trailing}</div>}
  </div>;
}
