import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface Match {
  id: string;
  team1_players: string[];
  team2_players: string[];
  user_team: number;
  result: 'W' | 'L';
  score: string;
  date: string;
}

interface RecentMatchesProps {
  matches: Match[];
}

export const RecentMatches = ({ matches }: RecentMatchesProps) => {
  if (matches.length === 0) return null;

  return (
    <div>
      {/* Last 10 Results Strip */}
      <div className="flex gap-1.5 mb-4">
        {matches.map((match, i) => (
          <div 
            key={i}
            className={cn(
              "w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold font-sans",
              match.result === 'W' 
                ? "bg-[#A9CF46] text-[#1a3a1f]" 
                : "bg-destructive text-destructive-foreground"
            )}
          >
            {match.result}
          </div>
        ))}
      </div>

      {/* Match Cards */}
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex gap-3">
          {matches.map((match) => (
            <div
              key={match.id}
              className={cn(
                "relative flex-shrink-0 w-[200px] p-4 pt-5 rounded-lg border bg-card transition-all duration-200",
                "hover:shadow-lg hover:scale-105",
                match.result === 'W' 
                  ? "border-l-4 border-l-[#A9CF46]" 
                  : "border-l-4 border-l-destructive"
              )}
            >
              {/* W/L Badge in corner */}
              <div className={cn(
                "absolute -top-2 -left-2 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold font-display shadow-md",
                match.result === 'W' 
                  ? "bg-[#A9CF46] text-[#1a3a1f]" 
                  : "bg-destructive text-destructive-foreground"
              )}>
                {match.result}
              </div>

              <div className="space-y-1.5 mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium font-sans text-muted-foreground uppercase tracking-wide">
                    Team {match.user_team}
                  </span>
                </div>
                <p className="text-xs font-sans text-foreground">
                  {match.user_team === 1 ? match.team1_players.join(', ') : match.team2_players.join(', ')}
                </p>
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="text-xs font-medium font-sans text-muted-foreground uppercase tracking-wide">
                    vs Team {match.user_team === 1 ? 2 : 1}
                  </span>
                </div>
                <p className="text-xs font-sans text-foreground">
                  {match.user_team === 1 ? match.team2_players.join(', ') : match.team1_players.join(', ')}
                </p>
              </div>
              <p className="text-xs text-muted-foreground font-sans mb-2" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {match.score}
              </p>
              <p className="text-xs text-muted-foreground font-sans">
                {new Date(match.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </p>
            </div>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
};
