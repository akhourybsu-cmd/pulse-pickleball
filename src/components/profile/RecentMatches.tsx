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
  status?: string;
}

interface RecentMatchesProps {
  matches: Match[];
}

export const RecentMatches = ({ matches }: RecentMatchesProps) => {
  if (matches.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* W/L Results Strip - Horizontal scrollable */}
      <div className="overflow-x-auto scrollbar-hide">
        <div className="flex gap-2 pb-1 snap-x snap-mandatory">
          {matches.map((match, i) => (
            <div 
              key={i}
              className={cn(
                "flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center",
                "text-xs font-bold font-display snap-center",
                "transition-transform duration-200 hover:scale-110",
                match.status === 'pending' 
                  ? "bg-muted/50 text-muted-foreground border border-dashed border-muted-foreground/50"
                  : match.result === 'W' 
                    ? "bg-primary text-primary-foreground shadow-sm" 
                    : "bg-destructive text-destructive-foreground shadow-sm"
              )}
            >
              {match.status === 'pending' ? '–' : match.result}
            </div>
          ))}
        </div>
      </div>

      {/* Premium Match Cards */}
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex gap-3 pb-2">
          {matches.map((match, index) => (
            <div
              key={match.id}
              className={cn(
                "relative flex-shrink-0 w-[220px] rounded-xl border bg-card",
                "transition-all duration-200 ease-out",
                "hover:shadow-lg hover:scale-[1.02] hover:-translate-y-0.5",
                "active:scale-[0.98]",
                "opacity-0 animate-fade-up",
                match.status === 'pending' && "opacity-60"
              )}
              style={{ 
                animationDelay: `${index * 50}ms`,
                animationFillMode: 'forwards'
              }}
            >
              {/* Top row with result indicator */}
              <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-border/30">
                <div className="flex items-center gap-2">
                  {/* Result dot */}
                  <div 
                    className={cn(
                      "w-2.5 h-2.5 rounded-full",
                      match.status === 'pending'
                        ? "bg-muted-foreground/50"
                        : match.result === 'W'
                          ? "bg-primary"
                          : "bg-destructive"
                    )}
                  />
                  <span className={cn(
                    "text-sm font-display font-bold",
                    match.status === 'pending' && "text-muted-foreground"
                  )}>
                    {match.status === 'pending' ? 'Pending' : match.result === 'W' ? 'Victory' : 'Defeat'}
                  </span>
                </div>
                <span 
                  className="text-lg font-display font-bold"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {match.score}
                </span>
              </div>

              {/* Teams info */}
              <div className="px-4 py-3 space-y-2">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
                    Your Team
                  </p>
                  <p className="text-xs font-medium text-foreground truncate">
                    {match.user_team === 1 ? match.team1_players.join(' & ') : match.team2_players.join(' & ')}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
                    Opponents
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {match.user_team === 1 ? match.team2_players.join(' & ') : match.team1_players.join(' & ')}
                  </p>
                </div>
              </div>

              {/* Date footer */}
              <div className="px-4 pb-3">
                <p className="text-[10px] text-muted-foreground/70">
                  {new Date(match.date).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </p>
              </div>
            </div>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
};
