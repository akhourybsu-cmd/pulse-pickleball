import { TrendingUp } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface RatingsStepProps {
  ratingEligible: boolean;
  onRatingEligibleChange: (value: boolean) => void;
  ratingType: "ladder" | "league" | "playoffs" | "casual";
  onRatingTypeChange: (value: "ladder" | "league" | "playoffs" | "casual") => void;
}

export function RatingsStep({
  ratingEligible,
  onRatingEligibleChange,
  ratingType,
  onRatingTypeChange,
}: RatingsStepProps) {
  return (
    <div className="flex flex-col h-full">
      <h2 className="text-xl font-semibold mb-2">Include in PULSE ratings?</h2>
      <p className="text-muted-foreground text-sm mb-6">
        Results will affect player rankings
      </p>

      <div className="flex-1 space-y-6">
        <div className="flex items-center justify-between p-5 rounded-xl border bg-card">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-muted">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold">Rating Eligible</p>
              <p className="text-sm text-muted-foreground">
                Count towards PULSE ratings
              </p>
            </div>
          </div>
          <Switch
            checked={ratingEligible}
            onCheckedChange={onRatingEligibleChange}
          />
        </div>

        {ratingEligible && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Rating Type</Label>
            <Select value={ratingType} onValueChange={onRatingTypeChange}>
              <SelectTrigger className="h-14">
                <SelectValue placeholder="Select rating type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="league">League</SelectItem>
                <SelectItem value="ladder">Ladder</SelectItem>
                <SelectItem value="playoffs">Playoffs</SelectItem>
                <SelectItem value="casual">Casual</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </div>
  );
}
