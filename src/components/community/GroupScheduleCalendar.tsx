import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  isToday,
  format,
  addMonths,
  subMonths,
  parseISO,
} from 'date-fns';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface CalendarEventLite {
  id: string;
  start_time: string;       // ISO
  title: string;
}

interface GroupScheduleCalendarProps {
  events: CalendarEventLite[];
  selectedDate: Date | null;
  onSelectDate: (d: Date | null) => void;
}

/**
 * Month-grid calendar for the group Schedule tab.
 *
 * Visual: 7-col grid with day numbers and a small dot per event below the
 * day number (capped at 3 dots; 4+ shows "•+N"). Today gets a primary
 * outline ring; the selected day fills in with primary background.
 *
 * Tapping a day with events selects it (parent filters list). Tapping the
 * same day again (or another empty day) clears the selection.
 */
export function GroupScheduleCalendar({ events, selectedDate, onSelectDate }: GroupScheduleCalendarProps) {
  // Pivot month — defaults to the month containing the next event, or
  // today's month if there are none.
  const [pivot, setPivot] = useState<Date>(() => {
    const upcoming = events
      .map((e) => parseISO(e.start_time))
      .filter((d) => d.getTime() >= Date.now())
      .sort((a, b) => a.getTime() - b.getTime())[0];
    return startOfMonth(upcoming ?? new Date());
  });

  const monthLabel = format(pivot, 'MMMM yyyy');

  // 6-row, 7-col matrix covering the visible month (with leading/trailing
  // overflow days so the grid is rectangular).
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(pivot), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(pivot), { weekStartsOn: 0 });
    const arr: Date[] = [];
    let d = start;
    while (d <= end) {
      arr.push(d);
      d = addDays(d, 1);
    }
    return arr;
  }, [pivot]);

  // Group events by yyyy-MM-dd for O(1) lookup.
  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEventLite[]>();
    events.forEach((e) => {
      const key = format(parseISO(e.start_time), 'yyyy-MM-dd');
      const existing = map.get(key) ?? [];
      existing.push(e);
      map.set(key, existing);
    });
    return map;
  }, [events]);

  const weekdays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-3 sm:p-4">
      {/* Header — month label + nav */}
      <div className="flex items-center justify-between mb-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setPivot((p) => subMonths(p, 1))}
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-sm font-semibold tracking-tight">{monthLabel}</div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setPivot((p) => addMonths(p, 1))}
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Weekday header row */}
      <div className="grid grid-cols-7 mb-1.5">
        {weekdays.map((w, i) => (
          <div
            key={i}
            className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-center"
          >
            {w}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, idx) => {
          const key = format(day, 'yyyy-MM-dd');
          const dayEvents = eventsByDay.get(key) ?? [];
          const hasEvents = dayEvents.length > 0;
          const inMonth = isSameMonth(day, pivot);
          const isSelected = selectedDate != null && isSameDay(day, selectedDate);
          const today = isToday(day);

          return (
            <motion.button
              key={key}
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.15, delay: idx * 0.005 }}
              onClick={() => {
                if (isSelected) onSelectDate(null);
                else onSelectDate(day);
              }}
              className={cn(
                'relative aspect-square rounded-md flex flex-col items-center justify-center',
                'text-xs transition-all duration-150',
                'hover:bg-muted/60 active:scale-95',
                !inMonth && 'text-muted-foreground/40',
                inMonth && !isSelected && !today && 'text-foreground',
                today && !isSelected && 'ring-1 ring-primary/40 text-primary font-semibold',
                isSelected && 'bg-primary text-primary-foreground font-semibold shadow-sm',
              )}
              aria-label={`${format(day, 'MMMM d')}${hasEvents ? ` — ${dayEvents.length} event${dayEvents.length === 1 ? '' : 's'}` : ''}`}
            >
              <span className="leading-none">{format(day, 'd')}</span>
              {hasEvents && (
                <div className="flex items-center gap-0.5 mt-1">
                  {dayEvents.length <= 3 ? (
                    dayEvents.map((_, i) => (
                      <span
                        key={i}
                        className={cn(
                          'h-1 w-1 rounded-full',
                          isSelected ? 'bg-primary-foreground' : 'bg-primary',
                        )}
                      />
                    ))
                  ) : (
                    <span
                      className={cn(
                        'text-[8px] font-bold leading-none',
                        isSelected ? 'text-primary-foreground' : 'text-primary',
                      )}
                    >
                      •+{dayEvents.length - 1}
                    </span>
                  )}
                </div>
              )}
            </motion.button>
          );
        })}
      </div>

      {selectedDate && (
        <div className="mt-3 pt-3 border-t border-border/40 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            Showing <span className="font-semibold text-foreground">{format(selectedDate, 'EEE, MMM d')}</span>
          </span>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onSelectDate(null)}>
            Clear
          </Button>
        </div>
      )}
    </div>
  );
}
