import { Check } from 'lucide-react';
import { EVENT_TYPE_OPTIONS, type EventFormat } from '../types';
import { cn } from '@/lib/utils';

interface EventTypeStepProps {
  value: EventFormat | null;
  onChange: (type: EventFormat) => void;
}

export function EventTypeStep({ value, onChange }: EventTypeStepProps) {
  return (
    <div className="space-y-3">
      <p className="text-[13px] text-muted-foreground">
        Pick the format — you can add courts, capacity and a repeat schedule next.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {EVENT_TYPE_OPTIONS.map((option) => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={cn(
                'relative rounded-2xl border p-3 text-left transition-all',
                selected
                  ? 'border-primary/60 bg-primary/10 shadow-[0_8px_24px_-16px_hsl(var(--primary)/0.7)]'
                  : 'border-border/70 bg-card/70 hover:border-primary/40 hover:bg-muted/50',
              )}
            >
              {selected && (
                <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="h-3 w-3" />
                </span>
              )}
              <span className="mb-1 block text-xl">{option.icon}</span>
              <span className="block text-sm font-bold tracking-tight">{option.label}</span>
              <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                {option.tagline}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
