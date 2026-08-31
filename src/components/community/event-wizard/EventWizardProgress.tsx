import { ArrowLeft, X, CalendarPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EVENT_WIZARD_STEPS } from './types';
import { cn } from '@/lib/utils';

interface EventWizardProgressProps {
  currentStep: number;
  onBack: () => void;
  onClose: () => void;
  canGoBack: boolean;
}

/**
 * PULSE premium title band for the event wizard: ambient primary bloom,
 * court-line texture, accent-ruled eyebrow and a scoreboard-style step meter.
 */
export function EventWizardProgress({
  currentStep,
  onBack,
  onClose,
  canGoBack,
}: EventWizardProgressProps) {
  const total = EVENT_WIZARD_STEPS.length;
  const step = EVENT_WIZARD_STEPS[currentStep];

  return (
    <div className="relative -mx-4 -mt-4 mb-4 overflow-hidden border-b border-border/60 bg-gradient-to-b from-primary/[0.12] via-primary/[0.04] to-transparent px-4 pb-3 pt-3">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 -left-10 h-48 w-48 rounded-full opacity-[0.18] blur-3xl"
        style={{ background: 'radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)' }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(115deg, hsl(var(--foreground)) 0px, hsl(var(--foreground)) 1px, transparent 1px, transparent 22px)',
        }}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {canGoBack ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 rounded-xl border border-border/60 bg-card/70"
              onClick={onBack}
              aria-label="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          ) : (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
              <CalendarPlus className="h-[18px] w-[18px]" />
            </span>
          )}
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary/80">
              New Community Event
            </div>
            <h3 className="truncate text-[19px] font-extrabold leading-tight tracking-[-0.01em]">
              {step.label}
            </h3>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden text-[10px] font-bold uppercase tracking-[0.16em] tabular-nums text-muted-foreground sm:inline">
            Step {currentStep + 1}/{total}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-xl text-muted-foreground"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="relative mt-3 flex items-center gap-1.5">
        {EVENT_WIZARD_STEPS.map((s, i) => (
          <span
            key={s.id}
            className={cn(
              'h-1 flex-1 rounded-full transition-colors',
              i < currentStep && 'bg-primary/60',
              i === currentStep && 'bg-primary',
              i > currentStep && 'bg-border/70',
            )}
          />
        ))}
      </div>
    </div>
  );
}
