import { useNavigate } from "react-router-dom";
import { Plus, Compass, Users, Trophy, Repeat, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickAction {
  label: string;
  description?: string;
  icon: React.ReactNode;
  path: string;
  primary?: boolean;
  tourTag?: string;
}

/**
 * Primary action surface on the player dashboard.
 * Record Match is the most prominent action — it's the single most important
 * thing a casual player does. The other three open the Play hub at the right
 * filter so the dashboard never lands the player on a generic catch-all.
 */
export const QuickActionsBar = () => {
  const navigate = useNavigate();

  const recordMatch: QuickAction = {
    label: "Record Match",
    description: "Log a casual game",
    icon: <Plus className="w-5 h-5" strokeWidth={2.5} />,
    path: "/player/matches/new",
    primary: true,
    tourTag: "record-match",
  };

  const secondaryActions: QuickAction[] = [
    {
      label: "Find Play",
      icon: <Compass className="w-5 h-5" />,
      path: "/player/play",
      tourTag: "find-play",
    },
    {
      label: "Round Robins",
      icon: <Users className="w-5 h-5" />,
      path: "/player/play?type=round_robin",
    },
    {
      label: "Tournaments",
      icon: <Trophy className="w-5 h-5" />,
      path: "/player/play?type=tournament",
    },
  ];

  return (
    <div className="space-y-3" data-tour="quick-actions">
      {/* Primary action — Record Match — spans full width with description */}
      <button
        onClick={() => navigate(recordMatch.path)}
        data-tour={recordMatch.tourTag}
        className={cn(
          "w-full flex items-center gap-3 px-5 py-4 rounded-xl",
          "bg-primary text-primary-foreground shadow-md",
          "hover:bg-primary/90 hover:shadow-lg active:scale-[0.99]",
          "transition-all duration-200 ease-out"
        )}
      >
        <div className="h-10 w-10 rounded-lg bg-primary-foreground/15 flex items-center justify-center flex-shrink-0">
          {recordMatch.icon}
        </div>
        <div className="text-left">
          <div className="font-semibold text-base tracking-tight">{recordMatch.label}</div>
          {recordMatch.description && (
            <div className="text-xs text-primary-foreground/80">{recordMatch.description}</div>
          )}
        </div>
      </button>

      {/* Secondary actions — 3-column grid (stacks at very narrow widths) */}
      <div className="grid grid-cols-3 gap-2">
        {secondaryActions.map((action) => (
          <button
            key={action.path}
            onClick={() => navigate(action.path)}
            data-tour={action.tourTag}
            className={cn(
              "flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-xl",
              "bg-card border border-border/40 text-foreground",
              "hover:border-primary/40 hover:bg-muted/30 active:scale-[0.98]",
              "transition-all duration-200 ease-out"
            )}
          >
            <span className="text-primary">{action.icon}</span>
            <span className="text-xs font-medium tracking-tight text-center leading-tight">
              {action.label}
            </span>
          </button>
        ))}
      </div>

      {/* Host action — for players who organize, not just attend. Distinct from
          the three browse tiles above because the verb is "create", not "find". */}
      <button
        onClick={() => navigate("/round-robin/create")}
        data-tour="host-round-robin"
        className={cn(
          "w-full flex items-center gap-3 px-4 py-3 rounded-xl",
          "bg-card border border-border/40 text-left",
          "hover:border-primary/40 hover:bg-muted/30 active:scale-[0.99]",
          "transition-all duration-200 ease-out"
        )}
      >
        <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
          <Repeat className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-foreground">Host a Round Robin</div>
          <div className="text-xs text-muted-foreground">
            Set up rotating play with auto-scheduling
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      </button>
    </div>
  );
};
