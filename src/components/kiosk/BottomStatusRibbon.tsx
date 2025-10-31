import { Badge } from "@/components/ui/badge";
import { Radio } from "lucide-react";

interface BottomStatusRibbonProps {
  currentRound: number;
  totalRounds: number;
  numCourts: number;
  allFinal: boolean;
}

export function BottomStatusRibbon({
  currentRound,
  totalRounds,
  numCourts,
  allFinal,
}: BottomStatusRibbonProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-primary via-accent to-primary py-4 px-6 z-50 shadow-lg">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Badge variant="secondary" className="text-base px-3 py-1 bg-background/90">
            <Radio className="w-4 h-4 mr-2 animate-pulse" />
            LIVE
          </Badge>
          <span className="text-lg font-bold text-white">
            {allFinal
              ? `Round ${currentRound} complete. Stand by for Round ${currentRound + 1} assignments.`
              : `Round ${currentRound} currently live on Courts 1–${numCourts}`}
          </span>
        </div>
        <div className="text-sm text-white/80">
          Round {currentRound} of {totalRounds}
        </div>
      </div>
    </div>
  );
}
