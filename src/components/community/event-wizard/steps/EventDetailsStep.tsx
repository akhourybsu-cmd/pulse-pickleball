import { Settings2, MapPin, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface EventDetailsStepProps {
  location: string;
  capacity: number | null;
  onLocationChange: (location: string) => void;
  onCapacityChange: (capacity: number | null) => void;
}

const CAPACITY_QUICK = [8, 12, 16, 24];

export function EventDetailsStep({
  location,
  capacity,
  onLocationChange,
  onCapacityChange,
}: EventDetailsStepProps) {
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary flex-shrink-0">
          <Settings2 className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h3 className="text-lg font-semibold leading-tight">Anything else?</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Skip this step if you don't have a venue or capacity in mind yet.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium flex items-center gap-1.5">
            <MapPin className="h-3 w-3 text-muted-foreground" /> Location
          </Label>
          <Input
            placeholder="e.g., North Attleboro YMCA"
            value={location}
            onChange={(e) => onLocationChange(e.target.value)}
            maxLength={120}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium flex items-center gap-1.5">
            <Users className="h-3 w-3 text-muted-foreground" /> Capacity
          </Label>
          <div className="flex flex-wrap gap-1.5">
            {CAPACITY_QUICK.map((n) => {
              const active = capacity === n;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => onCapacityChange(active ? null : n)}
                  className={cn(
                    'rounded-md border px-3 py-1.5 text-xs font-medium transition-all duration-150 active:scale-[0.98]',
                    active
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border/60 hover:border-primary/40 hover:bg-muted/40',
                  )}
                >
                  {n}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => onCapacityChange(null)}
              className={cn(
                'rounded-md border px-3 py-1.5 text-xs font-medium transition-all duration-150 active:scale-[0.98]',
                capacity == null
                  ? 'border-primary bg-primary/15 text-primary'
                  : 'border-border/60 text-muted-foreground hover:border-primary/40',
              )}
            >
              No limit
            </button>
          </div>
          <Input
            type="number"
            placeholder="Custom number"
            value={capacity ?? ''}
            onChange={(e) => onCapacityChange(e.target.value ? parseInt(e.target.value) : null)}
            min={1}
            className="mt-1"
          />
        </div>
      </div>
    </div>
  );
}
