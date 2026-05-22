import { useNavigate } from "react-router-dom";
import { Users, Trophy, MapPin, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ExploreTile {
  label: string;
  description: string;
  icon: React.ReactNode;
  to: string;
}

/**
 * "Explore PULSE" — a small, honest exploration row.
 *
 * Intentionally NOT a personalized recommendation feed. The brief is explicit:
 * if location-based recommendations aren't wired, use a safe explore section
 * that doesn't pretend to be personalized. Each tile is a thin shortcut into
 * the Play hub at the right filter.
 */
export function ExploreCard() {
  const navigate = useNavigate();

  const tiles: ExploreTile[] = [
    {
      label: "Round Robins",
      description: "Quick, social play",
      icon: <Users className="h-5 w-5" />,
      to: "/player/play?type=round_robin",
    },
    {
      label: "Tournaments",
      description: "Competitive brackets",
      icon: <Trophy className="h-5 w-5" />,
      to: "/player/play?type=tournament",
    },
    {
      label: "Venues",
      description: "Places to play near you",
      icon: <MapPin className="h-5 w-5" />,
      to: "/player/play?tab=venues",
    },
  ];

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border/50">
        <h3 className="text-sm font-medium text-foreground">Explore PULSE</h3>
      </div>
      <div className="p-3 space-y-2">
        {tiles.map((tile) => (
          <button
            key={tile.to}
            onClick={() => navigate(tile.to)}
            className={cn(
              "w-full flex items-center gap-3 p-2.5 rounded-lg text-left",
              "bg-muted/40 hover:bg-muted transition-colors"
            )}
          >
            <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
              {tile.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-foreground">{tile.label}</div>
              <div className="text-xs text-muted-foreground truncate">{tile.description}</div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}
