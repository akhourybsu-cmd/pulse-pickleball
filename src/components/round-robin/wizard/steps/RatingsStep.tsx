import { TrendingUp, UserPlus, AlertCircle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
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
        Decide whether this round robin counts toward PULSE Ratings.
      </p>

      <div className="flex-1 space-y-6">
        {/* Guest toggle */}
        <div className="p-5 rounded-xl border bg-card">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-muted shrink-0">
                <UserPlus className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <p className="font-semibold leading-tight">Allow guest players</p>
                <p className="text-sm text-muted-foreground">
                  Guest players are great for open play and casual groups.
                  Because guests are unverified, this round robin won't count
                  toward PULSE Ratings.
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
            <div className="mt-4 flex items-start gap-2 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>
                Heads up: scheduled generation and live scoring don't yet
                support guest slots. You'll be prompted to swap guests for
                registered players before generating a schedule.
              </span>
            </div>
          )}
        </div>

        {/* Rating eligible */}
        <div
          className={cn(
            "flex items-center justify-between p-5 rounded-xl border bg-card transition-opacity",
            allowGuests && "opacity-70",
          )}
        >
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-muted">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold">Rating Eligible</p>
              <p className="text-sm text-muted-foreground">
                {allowGuests
                  ? "Off while guests are allowed"
                  : "Count results toward PULSE Ratings"}
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

