import { User, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { MatchWizardFormData } from "../hooks/useMatchWizardSteps";

interface MatchTypeStepProps {
  formData: MatchWizardFormData;
  updateFormData: <K extends keyof MatchWizardFormData>(field: K, value: MatchWizardFormData[K]) => void;
  onAutoAdvance: () => void;
}

export function MatchTypeStep({ formData, updateFormData, onAutoAdvance }: MatchTypeStepProps) {
  const handleSelect = (type: 'singles' | 'doubles') => {
    updateFormData('matchFormat', type);
    
    // Reset teams based on format
    const slotsPerTeam = type === 'singles' ? 1 : 2;
    const emptySlots = Array(slotsPerTeam).fill(null).map(() => ({
      playerId: null,
      isGuest: false,
    }));
    
    updateFormData('team1', emptySlots);
    updateFormData('team2', emptySlots);
    
    // Save preference
    localStorage.setItem('pulse-last-match-format', type);
    
    // Auto-advance after short delay
    setTimeout(onAutoAdvance, 150);
  };

  return (
    <div className="space-y-4">
      <div className="text-sm font-medium text-muted-foreground text-center mb-6">
        What type of match?
      </div>

      <div className="space-y-3">
        <Card
          className="p-6 opacity-60 cursor-not-allowed bg-muted/30"
          aria-disabled="true"
        >
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
              <User className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <div className="text-xl font-semibold text-muted-foreground">Singles</div>
              <div className="text-xs font-semibold text-primary mt-1 uppercase tracking-wide">
                Coming soon
              </div>
            </div>
          </div>
        </Card>

        <Card
          className={`p-6 cursor-pointer transition-all ${
            formData.matchFormat === 'doubles'
              ? 'ring-2 ring-primary bg-primary/5'
              : 'hover:bg-accent'
          }`}
          onClick={() => handleSelect('doubles')}
        >
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="h-8 w-8 text-primary" />
            </div>
            <div>
              <div className="text-xl font-semibold">Doubles</div>
              <div className="text-sm text-muted-foreground">2 vs 2 match</div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
