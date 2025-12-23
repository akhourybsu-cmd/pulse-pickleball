import { useRef, useEffect } from 'react';
import { format, addDays, startOfToday, isSameDay, isToday, isTomorrow } from 'date-fns';
import { cn } from '@/lib/utils';

interface DatePickerStripProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  numberOfDays?: number;
}

export function DatePickerStrip({ selectedDate, onSelectDate, numberOfDays = 14 }: DatePickerStripProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const dates = Array.from({ length: numberOfDays }, (_, i) => addDays(startOfToday(), i));

  // Scroll selected date into view on mount
  useEffect(() => {
    const selectedIndex = dates.findIndex(d => isSameDay(d, selectedDate));
    if (selectedIndex > 0 && scrollRef.current) {
      const button = scrollRef.current.children[selectedIndex] as HTMLElement;
      if (button) {
        button.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  }, []);

  const getDateLabel = (date: Date) => {
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'EEE, M/d');
  };

  return (
    <div 
      ref={scrollRef}
      className="flex gap-1 overflow-x-auto pb-2 scrollbar-hide"
    >
      {dates.map((date) => {
        const isSelected = isSameDay(date, selectedDate);
        return (
          <button
            key={date.toISOString()}
            onClick={() => onSelectDate(date)}
            className={cn(
              "flex-shrink-0 px-4 py-2 text-sm font-medium transition-all whitespace-nowrap",
              isSelected 
                ? "border-b-2 border-primary text-foreground" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {getDateLabel(date)}
          </button>
        );
      })}
    </div>
  );
}
