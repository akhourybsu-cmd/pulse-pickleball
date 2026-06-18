import { motion } from 'framer-motion';
import { CalendarPlus } from 'lucide-react';
import { EventWizardFormData, EVENT_TYPE_OPTIONS } from '../types';
import { cn } from '@/lib/utils';

interface EventTypeStepProps {
  value: EventWizardFormData['eventType'];
  onChange: (type: EventWizardFormData['eventType']) => void;
}

export function EventTypeStep({ value, onChange }: EventTypeStepProps) {
  return (
    <div className="space-y-5">
      {/* Hero — pattern matches the RR wizard step header. */}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary flex-shrink-0">
          <CalendarPlus className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h3 className="text-lg font-semibold leading-tight">What type of event?</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Pick a vibe — you can change the name on the next step.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {EVENT_TYPE_OPTIONS.map((option, i) => {
          const selected = value === option.value;
          return (
            <motion.button
              key={option.value}
              type="button"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: i * 0.04 }}
              onClick={() => onChange(option.value)}
              className={cn(
                'group relative text-left rounded-xl border-2 p-3 sm:p-3.5 transition-all duration-150',
                'active:scale-[0.98]',
                selected
                  ? 'border-primary bg-primary/10 shadow-[0_4px_14px_-6px_hsl(var(--primary)/0.40)]'
                  : 'border-border/60 hover:border-primary/40 hover:bg-muted/40',
              )}
            >
              <div className="flex items-start gap-2">
                <span className="text-xl leading-none mt-0.5">{option.icon}</span>
                <div className="min-w-0">
                  <div className="font-semibold text-sm">{option.label}</div>
                  <div className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                    {option.blurb}
                  </div>
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
