import { TrendingUp, UserPlus, AlertCircle } from "lucide-react";
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
  allowGuests: boolean;
  onAllowGuestsChange: (value: boolean) => void;
}

export function RatingsStep({
  ratingEligible,
  onRatingEligibleChange,
  ratingType,
  onRatingTypeChange,
  allowGuests,
  onAllowGuestsChange,
}: RatingsStepProps) {
  const effectiveRatingEligible = allowGuests ? false : ratingEligible;

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-xl font-semibold mb-2">Ratings & guests</h2>
      <p className="text-muted-foreground text-sm mb-6">
        Configure how this round robin counts toward PULSE Ratings.
      </p>

      <div className="flex-1 space-y-6">
        {/* Guest toggle */}
        <div className="p-5 rounded-xl border bg-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-muted">
                <UserPlus className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold">Allow guest players</p>
                <p className="text-sm text-muted-foreground">
                  Useful for casual or open play
                </p>
              </div>
            </div>
            <Switch
              checked={allowGuests}
              onCheckedChange={(v) => {
                onAllowGuestsChange(v);
                if (v) onRatingEligibleChange(false);
              }}
            />
          </div>
          {allowGuests && (
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                This event won't count toward PULSE Ratings while guests are
                allowed.
              </span>
            </div>
          )}
        </div>

        {/* Rating eligible */}
        <div className="flex items-center justify-between p-5 rounded-xl border bg-card opacity-100">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-muted">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold">Rating Eligible</p>
              <p className="text-sm text-muted-foreground">
                {allowGuests
                  ? "Disabled — guests are enabled"
                  : "Count towards PULSE ratings"}
              </p>
            </div>
          </div>
          <Switch
            checked={effectiveRatingEligible}
            disabled={allowGuests}
            onCheckedChange={onRatingEligibleChange}
          />
        </div>

        {effectiveRatingEligible && (
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
