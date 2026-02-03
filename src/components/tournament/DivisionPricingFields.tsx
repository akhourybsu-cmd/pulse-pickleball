import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface DivisionPricingFieldsProps {
  registrationFee: string;
  earlyBirdFee: string;
  earlyBirdDeadline: Date | undefined;
  onRegistrationFeeChange: (value: string) => void;
  onEarlyBirdFeeChange: (value: string) => void;
  onEarlyBirdDeadlineChange: (date: Date | undefined) => void;
  disabled?: boolean;
}

export function DivisionPricingFields({
  registrationFee,
  earlyBirdFee,
  earlyBirdDeadline,
  onRegistrationFeeChange,
  onEarlyBirdFeeChange,
  onEarlyBirdDeadlineChange,
  disabled = false,
}: DivisionPricingFieldsProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Registration Fee ($)</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={registrationFee}
            onChange={(e) => onRegistrationFeeChange(e.target.value)}
            placeholder="Use event default"
            disabled={disabled}
          />
          <p className="text-xs text-muted-foreground">
            Override event fee for this division
          </p>
        </div>

        <div className="space-y-2">
          <Label>Early Bird Fee ($)</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={earlyBirdFee}
            onChange={(e) => onEarlyBirdFeeChange(e.target.value)}
            placeholder="No early bird"
            disabled={disabled}
          />
        </div>
      </div>

      {earlyBirdFee && (
        <div className="space-y-2">
          <Label>Early Bird Deadline</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !earlyBirdDeadline && "text-muted-foreground"
                )}
                disabled={disabled}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {earlyBirdDeadline ? format(earlyBirdDeadline, "PPP") : "Select deadline"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={earlyBirdDeadline}
                onSelect={onEarlyBirdDeadlineChange}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      )}
    </div>
  );
}

export function formatPricing(
  registrationFee: number | null,
  earlyBirdFee: number | null,
  earlyBirdDeadline: Date | null,
  eventDefaultFee: number | null
): { currentPrice: number; isEarlyBird: boolean; savings: number } {
  const baseFee = registrationFee ?? eventDefaultFee ?? 0;
  
  if (earlyBirdFee && earlyBirdDeadline && new Date() < earlyBirdDeadline) {
    return {
      currentPrice: earlyBirdFee,
      isEarlyBird: true,
      savings: baseFee - earlyBirdFee,
    };
  }

  return {
    currentPrice: baseFee,
    isEarlyBird: false,
    savings: 0,
  };
}
