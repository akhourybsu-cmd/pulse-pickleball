import { Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { VenueCourt } from '@/hooks/usePublicVenue';

interface CourtPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courts: VenueCourt[];
  selectedCourt: VenueCourt | null;
  onSelectCourt: (court: VenueCourt | null) => void;
  primaryColor: string;
}

export function CourtPickerModal({
  open,
  onOpenChange,
  courts,
  selectedCourt,
  onSelectCourt,
  primaryColor,
}: CourtPickerModalProps) {
  const isAutoSelected = selectedCourt === null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Select Court</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-2 py-2">
          {/* Auto Selection Option */}
          <button
            onClick={() => onSelectCourt(null)}
            className={cn(
              "w-full flex items-center justify-between p-4 rounded-lg border-2 transition-all",
              isAutoSelected
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50"
            )}
          >
            <div className="flex items-center gap-3">
              <div 
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm",
                  isAutoSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}
              >
                AUTO
              </div>
              <div className="text-left">
                <p className="font-medium">Auto selection</p>
                <Badge variant="secondary" className="mt-1 text-xs">
                  COURT ASSIGNED LATER
                </Badge>
              </div>
            </div>
            {isAutoSelected && (
              <Check className="w-5 h-5 text-primary" />
            )}
          </button>
          
          {/* Individual Courts */}
          {courts.map((court) => {
            const isSelected = selectedCourt?.id === court.id;
            const courtType = court.court_type || 'standard';
            const premiumFee = court.premium_fee || 0;
            
            return (
              <button
                key={court.id}
                onClick={() => onSelectCourt(court)}
                className={cn(
                  "w-full flex items-center justify-between p-4 rounded-lg border-2 transition-all",
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                )}
              >
                <div className="flex items-center gap-3">
                  <div 
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm",
                      isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    )}
                  >
                    {court.name.replace('Court ', 'C')}
                  </div>
                  <div className="text-left">
                    <p className="font-medium">{court.name}</p>
                    <Badge 
                      variant="secondary" 
                      className={cn(
                        "mt-1 text-xs uppercase",
                        courtType === 'championship' && "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
                        courtType === 'premium' && "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                      )}
                    >
                      {courtType === 'standard' ? 'STANDARD COURT' : `${courtType} COURT`}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {premiumFee > 0 ? (
                    <span className="text-sm font-medium" style={{ color: primaryColor }}>
                      +${premiumFee.toFixed(2)}
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">+$0.00</span>
                  )}
                  {isSelected && (
                    <Check className="w-5 h-5 text-primary" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
        
        <DialogFooter>
          <Button 
            className="w-full"
            onClick={() => onOpenChange(false)}
            style={{ backgroundColor: primaryColor }}
          >
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
