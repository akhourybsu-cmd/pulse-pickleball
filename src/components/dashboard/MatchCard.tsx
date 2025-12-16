import { format } from "date-fns";
import { MapPin, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface MatchCardProps {
  id: string;
  matchDate: string;
  userTeam: number;
  team1Score: number;
  team2Score: number;
  team1Players: { name: string; initials: string }[];
  team2Players: { name: string; initials: string }[];
  courtName?: string | null;
  location?: string | null;
  eventName?: string | null;
  ratingChange?: number;
  onClick?: () => void;
}

export const MatchCard = ({
  id,
  matchDate,
  userTeam,
  team1Score,
  team2Score,
  team1Players,
  team2Players,
  courtName,
  location,
  eventName,
  ratingChange,
  onClick,
}: MatchCardProps) => {
  const userScore = userTeam === 1 ? team1Score : team2Score;
  const oppScore = userTeam === 1 ? team2Score : team1Score;
  const isWin = userScore > oppScore;
  
  const userTeamPlayers = userTeam === 1 ? team1Players : team2Players;
  const oppTeamPlayers = userTeam === 1 ? team2Players : team1Players;

  return (
    <button
      onClick={onClick}
      className="w-full bg-card hover:bg-muted/50 rounded-xl p-4 text-left transition-colors border border-border"
    >
      {/* Header Row */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "px-2 py-0.5 rounded text-xs font-bold uppercase",
              isWin
                ? "bg-primary/20 text-primary"
                : "bg-destructive/20 text-destructive"
            )}
          >
            {isWin ? "Win" : "Loss"}
          </span>
          {ratingChange != null && ratingChange !== 0 && (
            <span
              className={cn(
                "text-xs font-medium",
                ratingChange > 0 ? "text-primary" : "text-destructive"
              )}
            >
              {ratingChange > 0 ? "+" : ""}
              {ratingChange.toFixed(2)}
            </span>
          )}
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>

      {/* Event/Court Name */}
      <div className="mb-2">
        <p className="text-sm font-medium text-foreground truncate">
          {eventName || courtName || "Open Play"}
        </p>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <span>{format(new Date(matchDate), "MMMM d, yyyy")}</span>
          {location && (
            <>
              <span>•</span>
              <MapPin className="h-3 w-3" />
              <span className="truncate">{location}</span>
            </>
          )}
        </div>
      </div>

      {/* Teams Display */}
      <div className="space-y-2 mt-3">
        {/* User's Team */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="flex -space-x-1">
              {userTeamPlayers.slice(0, 2).map((player, idx) => (
                <div
                  key={idx}
                  className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary border-2 border-card"
                >
                  {player.initials}
                </div>
              ))}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {userTeamPlayers.map((p) => p.name).join(" & ")}
              </p>
            </div>
          </div>
          <span
            className={cn(
              "text-lg font-bold min-w-[2rem] text-right",
              isWin ? "text-primary" : "text-muted-foreground"
            )}
          >
            {userScore}
          </span>
        </div>

        {/* Divider */}
        <div className="border-t border-border" />

        {/* Opponent Team */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="flex -space-x-1">
              {oppTeamPlayers.slice(0, 2).map((player, idx) => (
                <div
                  key={idx}
                  className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground border-2 border-card"
                >
                  {player.initials}
                </div>
              ))}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-muted-foreground truncate">
                {oppTeamPlayers.map((p) => p.name).join(" & ")}
              </p>
            </div>
          </div>
          <span
            className={cn(
              "text-lg font-bold min-w-[2rem] text-right",
              !isWin ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {oppScore}
          </span>
        </div>
      </div>

      {/* Match ID */}
      <p className="text-[10px] text-muted-foreground mt-3 uppercase tracking-wider">
        Match ID: {id.slice(0, 8).toUpperCase()}
      </p>
    </button>
  );
};
