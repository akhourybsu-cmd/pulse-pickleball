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
import { ScrollArea } from '@/components/ui/scroll-area';
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

// Generate short court code: "Championship Court 1" -> "C1"
function getCourtCode(name: string): string {
  const match = name.match(/(\d+)/);
  return match ? `C${match[1]}` : name.charAt(0).toUpperCase();
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
      <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle>Select Court</DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="flex-1 px-4">
          <div className="space-y-2 py-2">
            {/* Auto Selection Option */}
            <button
              onClick={() => onSelectCourt(null)}
              className={cn(
                "w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all",
                isAutoSelected
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              )}
            >
              <div 
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs shrink-0",
                  isAutoSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}
              >
                AUTO
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="font-medium truncate">Auto selection</p>
                <p className="text-xs text-muted-foreground">Court assigned later</p>
              </div>
              {isAutoSelected && (
                <Check className="w-5 h-5 text-primary shrink-0" />
              )}
            </button>
            
            {/* Individual Courts */}
            {courts.map((court) => {
              const isSelected = selectedCourt?.id === court.id;
              const courtType = court.court_type || 'standard';
              const premiumFee = court.premium_fee || 0;
              const courtCode = getCourtCode(court.name);
              
              return (
                <button
                  key={court.id}
                  onClick={() => onSelectCourt(court)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all",
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  {/* Court Code Circle */}
                  <div 
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0",
                      isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    )}
                  >
                    {courtCode}
                  </div>
                  
                  {/* Court Info */}
                  <div className="flex-1 text-left min-w-0">
                    <p className="font-medium truncate">{court.name}</p>
                    <Badge 
                      variant="secondary" 
                      className={cn(
                        "text-[10px] uppercase px-1.5 py-0",
                        courtType === 'championship' && "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
                        courtType === 'premium' && "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                      )}
                    >
                      {courtType}
                    </Badge>
                  </div>
                  
                  {/* Price & Check */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span 
                      className="text-sm font-medium"
                      style={{ color: premiumFee > 0 ? primaryColor : undefined }}
                    >
                      {premiumFee > 0 ? `+$${premiumFee.toFixed(0)}` : '+$0'}
                    </span>
                    {isSelected && (
                      <Check className="w-5 h-5 text-primary" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>
        
        <DialogFooter className="px-4 pb-4 pt-2 border-t border-border">
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
