import { Check, X, AlertTriangle, Trophy } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { ProfileCompletenessResult } from "@/lib/profileCompleteness";

interface TournamentReadinessCardProps {
  completeness: ProfileCompletenessResult;
  className?: string;
  compact?: boolean;
}

export function TournamentReadinessCard({ 
  completeness, 
  className,
  compact = false 
}: TournamentReadinessCardProps) {
  const { tournamentReady, missingRequired, missingRecommended, sections } = completeness;
  
  // Calculate tournament-specific percentage (required + recommended fields)
  const tournamentPercentage = sections.tournament.percentage;
  
  if (compact) {
    return (
      <div className={cn("flex items-center gap-3", className)}>
        <div className="flex items-center gap-2">
          <Trophy className={cn(
            "w-4 h-4",
            tournamentReady ? "text-primary" : "text-amber-500"
          )} />
          <span className="text-sm font-medium">
            {tournamentReady ? "Tournament Ready" : "Profile Incomplete"}
          </span>
        </div>
        <Progress value={tournamentPercentage} className="w-24 h-2" />
        <span className="text-xs text-muted-foreground">{tournamentPercentage}%</span>
      </div>
    );
  }
  
  return (
    <Card className={cn("border-primary/20", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className={cn(
              "w-5 h-5",
              tournamentReady ? "text-primary" : "text-amber-500"
            )} />
            <CardTitle className="text-lg">Tournament Readiness</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Progress value={tournamentPercentage} className="w-20 h-2" />
            <span className="text-sm font-medium">{tournamentPercentage}%</span>
          </div>
        </div>
        <CardDescription>
          {tournamentReady 
            ? "Your profile is ready for tournament registration!" 
            : "Complete your profile to register for tournaments"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Required Fields Status */}
        {missingRequired.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-4 h-4" />
              Required for Registration
            </h4>
            <ul className="space-y-1.5 pl-6">
              {missingRequired.map(({ label, reason }) => (
                <li key={label} className="text-sm flex items-start gap-2">
                  <X className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                  <span>
                    <span className="font-medium">{label}</span>
                    <span className="text-muted-foreground ml-1">— {reason}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Recommended Fields Status */}
        {missingRecommended.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2 text-amber-600 dark:text-amber-500">
              <AlertTriangle className="w-4 h-4" />
              Recommended
            </h4>
            <ul className="space-y-1.5 pl-6">
              {missingRecommended.slice(0, 5).map(({ label, reason }) => (
                <li key={label} className="text-sm flex items-start gap-2">
                  <X className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <span>
                    <span className="font-medium">{label}</span>
                    <span className="text-muted-foreground ml-1">— {reason}</span>
                  </span>
                </li>
              ))}
              {missingRecommended.length > 5 && (
                <li className="text-sm text-muted-foreground pl-6">
                  +{missingRecommended.length - 5} more fields
                </li>
              )}
            </ul>
          </div>
        )}
        
        {/* All Complete */}
        {tournamentReady && missingRecommended.length === 0 && (
          <div className="flex items-center gap-2 text-primary">
            <Check className="w-5 h-5" />
            <span className="font-medium">All profile fields complete!</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
