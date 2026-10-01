import {
  CalendarDays,
  Check,
  GraduationCap,
  Sparkles,
  Target,
  Trophy,
  Users,
} from 'lucide-react';
import { EVENT_TYPE_OPTIONS, type EventFormat } from '../types';
import { cn } from '@/lib/utils';

interface EventTypeStepProps {
  value: EventFormat | null;
  onChange: (type: EventFormat) => void;
  venueMode?: boolean;
}

const FORMAT_ICON: Record<EventFormat, typeof Users> = {
  open_play: Users,
  round_robin: Trophy,
  practice: Target,
  clinic: GraduationCap,
  social: Sparkles,
  other: CalendarDays,
};

export function EventTypeStep({ value, onChange, venueMode = false }: EventTypeStepProps) {
  return (
    <div className="space-y-3">
      <p className="text-[13px] text-muted-foreground">
        {venueMode
          ? 'Start with the program players recognize. Courts, level, rotation, and registration come next.'
          : 'Choose a format, then give your event a name.'}
      </p>
      <div className="grid grid-cols-2 gap-2">
        {EVENT_TYPE_OPTIONS.map((option) => {
          const selected = value === option.value;
          const Icon = FORMAT_ICON[option.value];
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(option.value)}
              className={cn(
                'group relative min-h-[116px] rounded-2xl border p-3.5 text-left transition-[border-color,background-color,transform,box-shadow]',
                !venueMode && 'min-h-0 p-3',
                selected
                  ? 'border-primary/60 bg-primary/[0.08] shadow-[0_12px_30px_-22px_hsl(var(--primary)/0.8)]'
                  : 'border-border/70 bg-card/75 hover:-translate-y-px hover:border-primary/35 hover:bg-card',
              )}
            >
              {selected && (
                <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="h-3 w-3" />
                </span>
              )}
              <span
                className={cn(
                  'mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-colors',
                  !venueMode && 'float-left mb-0 mr-2.5 h-8 w-8',
                  selected && 'bg-primary text-primary-foreground',
                )}
              >
                <Icon className="h-[17px] w-[17px]" />
              </span>
              <span className="block text-sm font-extrabold tracking-tight">{option.label}</span>
              <span className={cn('mt-1 block text-[11px] leading-snug text-muted-foreground', !venueMode && 'hidden sm:block')}>
                {!venueMode && option.value === 'other' ? 'A custom event for your group' : option.tagline}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
