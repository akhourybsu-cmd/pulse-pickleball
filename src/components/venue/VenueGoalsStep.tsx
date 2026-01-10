import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Goal {
  id: string;
  label: string;
  description: string;
}

const GOALS: Goal[] = [
  {
    id: 'tournaments',
    label: 'Host Tournaments',
    description: 'Run competitive tournaments with brackets and prizes',
  },
  {
    id: 'round_robins',
    label: 'Run Round Robins',
    description: 'Organize casual round robin events and open play',
  },
  {
    id: 'presence',
    label: 'Build Venue Presence',
    description: 'Create a public profile for your venue on Pulse',
  },
  {
    id: 'community',
    label: 'Grow Community',
    description: 'Build a local pickleball community around your venue',
  },
];

interface VenueGoalsStepProps {
  selectedGoals: string[];
  onToggleGoal: (goalId: string) => void;
}

export function VenueGoalsStep({ selectedGoals, onToggleGoal }: VenueGoalsStepProps) {
  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold mb-1">What are your goals?</h2>
        <p className="text-sm text-muted-foreground">
          Select all that apply. You can change these anytime.
        </p>
      </div>

      <div className="grid gap-3">
        {GOALS.map((goal) => {
          const isSelected = selectedGoals.includes(goal.id);
          return (
            <button
              key={goal.id}
              type="button"
              onClick={() => onToggleGoal(goal.id)}
              className={cn(
                'flex items-start gap-4 p-4 rounded-lg border-2 text-left transition-all',
                isSelected
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50 hover:bg-muted/50'
              )}
            >
              <div
                className={cn(
                  'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                  isSelected
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-muted-foreground/50'
                )}
              >
                {isSelected && <Check className="h-3 w-3" />}
              </div>
              <div>
                <p className="font-medium">{goal.label}</p>
                <p className="text-sm text-muted-foreground">{goal.description}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
