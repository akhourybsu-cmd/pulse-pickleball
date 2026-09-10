import { useEffect, useMemo, useRef } from 'react';
import { cn } from '@/lib/utils';
import { venueCalendarNow } from '@/lib/venues/timezone';

/**
 * Horizontal day picker.
 *
 * Replaces a prev/next stepper, which forces one tap per day and never shows
 * where you are in the week. A venue's whole rhythm is weekly — "is Saturday
 * busy?" is one glance here and four taps with arrows.
 *
 * Today and Tomorrow are named rather than dated, because that is how anyone
 * standing at a desk refers to them.
 */

interface DayStripProps {
  value: Date;
  timeZone?: string | null;
  onChange: (day: Date) => void;
  /** How many days forward to offer. */
  days?: number;
  accent?: string | null;
  /**
   * Pinned to the right of the strip, outside its scroll area. Controls that
   * belong to the same day of data ride here rather than claiming a row of
   * their own — three stacked header rows before any content is most of what
   * makes a screen feel assembled rather than designed.
   */
  trailing?: React.ReactNode;
}

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

export function DayStrip({ value, onChange, days = 14, accent, trailing, timeZone }: DayStripProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  const options = useMemo(() => {
    const today = startOfDay(venueCalendarNow(timeZone));
    return Array.from({ length: days }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [days, timeZone]);

  // Keep the chosen day in view when it changes from outside (a gap tapped on
  // the ops board, say), without yanking the whole page.
  useEffect(() => {
    const strip = scroller.current;
    const active = activeRef.current;
    if (!strip || !active) return;
    // scrollIntoView scrolls every ancestor, including the page. Move only
    // this horizontal strip so initial render never jumps to the calendar.
    const offset = active.getBoundingClientRect().left - strip.getBoundingClientRect().left;
    strip.scrollTo({ left: strip.scrollLeft + offset - (strip.clientWidth - active.offsetWidth) / 2 });
  }, [value]);

  return (
    <div className="-mx-4 flex items-end gap-3 border-b border-border px-4">
      <div
        ref={scroller}
        className="scrollbar-hide min-w-0 flex-1 overflow-x-auto overflow-y-hidden"
        role="tablist"
        aria-label="Choose a day"
      >
        <div className="flex min-w-max items-stretch gap-1">
        {options.map((day, i) => {
          const active = day.getTime() === startOfDay(value).getTime();
          const label =
            i === 0
              ? 'Today'
              : i === 1
                ? 'Tomorrow'
                : day.toLocaleDateString([], { weekday: 'short' });
          const sub =
            i < 2 ? null : `${day.getMonth() + 1}/${day.getDate()}`;

          return (
            <button
              key={day.toISOString()}
              ref={active ? activeRef : undefined}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(day)}
              className={cn(
                'relative min-h-11 shrink-0 px-3 py-2.5 text-sm transition-colors',
                active ? 'font-bold text-foreground' : 'font-medium text-muted-foreground hover:text-foreground',
              )}
            >
              <span className="whitespace-nowrap">
                {label}
                {sub && <span className="ml-1 tabular-nums opacity-80">{sub}</span>}
              </span>
              <span
                aria-hidden
                className={cn(
                  'absolute inset-x-2 bottom-0 h-[2px] rounded-full transition-opacity',
                  active ? 'bg-primary opacity-100' : 'opacity-0',
                )}
                style={active && accent ? { backgroundColor: accent } : undefined}
              />
              </button>
            );
          })}
        </div>
      </div>

      {trailing && <div className="shrink-0 pb-1.5">{trailing}</div>}
    </div>
  );
}
