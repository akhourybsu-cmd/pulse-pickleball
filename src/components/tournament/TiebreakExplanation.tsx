import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

interface TiebreakData {
  teamId: string;
  teamName: string;
  wins: number;
  pointDiff: number;
  headToHeadWins: number;
  headToHeadLosses: number;
  tiedWith?: string[];
  tiebreakReason?: string;
}

interface TiebreakExplanationProps {
  currentTeam: TiebreakData;
  previousTeam?: TiebreakData;
  showDetailed?: boolean;
}

export function TiebreakExplanation({ 
  currentTeam, 
  previousTeam, 
  showDetailed = false 
}: TiebreakExplanationProps) {
  // If no previous team or different wins, no tiebreaker needed
  if (!previousTeam || currentTeam.wins !== previousTeam.wins) {
    return null;
  }

  const getTiebreakReason = (): string => {
    // Head-to-head
    if (currentTeam.headToHeadWins > currentTeam.headToHeadLosses) {
      return `Won head-to-head vs ${previousTeam.teamName}`;
    }
    if (currentTeam.headToHeadWins < currentTeam.headToHeadLosses) {
      return `Lost head-to-head vs ${previousTeam.teamName}`;
    }
    
    // Point differential
    if (currentTeam.pointDiff !== previousTeam.pointDiff) {
      if (currentTeam.pointDiff > previousTeam.pointDiff) {
        return `Better point differential (+${currentTeam.pointDiff} vs +${previousTeam.pointDiff})`;
      }
      return `Lower point differential (+${currentTeam.pointDiff} vs +${previousTeam.pointDiff})`;
    }

    return "Tied (all tiebreakers equal)";
  };

  const reason = getTiebreakReason();
  const isTied = reason.startsWith("Tied");

  if (showDetailed) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
            <Info className={`h-4 w-4 ${isTied ? "text-amber-500" : "text-muted-foreground"}`} />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72" align="start">
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Tiebreak Explanation</h4>
            <p className="text-sm text-muted-foreground">
              Both teams have {currentTeam.wins} win{currentTeam.wins !== 1 ? "s" : ""}.
            </p>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Head-to-Head:</span>
                <span className="font-medium">
                  {currentTeam.headToHeadWins}-{currentTeam.headToHeadLosses}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Point Differential:</span>
                <span className={`font-medium ${currentTeam.pointDiff >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {currentTeam.pointDiff > 0 ? "+" : ""}{currentTeam.pointDiff}
                </span>
              </div>
            </div>
            <div className={`pt-2 border-t text-sm ${isTied ? "text-amber-600" : "text-primary"}`}>
              <strong>Result:</strong> {reason}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help">
            <Info className={`h-3.5 w-3.5 inline ml-1 ${isTied ? "text-amber-500" : "text-muted-foreground"}`} />
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-sm">{reason}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
