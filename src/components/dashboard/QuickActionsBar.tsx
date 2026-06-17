import { useNavigate } from "react-router-dom";
import { Plus, Compass, Repeat, ChevronRight } from "lucide-react";
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

  // Single secondary discover action — "Find Play" routes to the unified
  // events feed. The previous "Round Robins" tile was dropped because
  // the dashboard now surfaces the user's actual round robins directly
  // (via MyRoundRobinsCard), so the catch-all hub link became redundant.
  // "Host a Round Robin" stays below for the create flow.
  const findPlay: QuickAction = {
    label: "Find Play",
    description: "Round robins, open play, clinics, leagues near you",
    icon: <Compass className="w-5 h-5" />,
    path: "/player/play",
    tourTag: "find-play",
  };

  return (
    <div className="space-y-3" data-tour="quick-actions">
      {/* Primary action — Record Match — full width with description */}
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

      {/* Find Play — secondary discover action, full-width row */}
      <button
        onClick={() => navigate(findPlay.path)}
        data-tour={findPlay.tourTag}
        className={cn(
          "w-full flex items-center gap-3 px-4 py-3 rounded-xl",
          "bg-card border border-border/40 text-left",
          "hover:border-primary/40 hover:bg-muted/30 active:scale-[0.99]",
          "transition-all duration-200 ease-out"
        )}
      >
        <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
          {findPlay.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-foreground">{findPlay.label}</div>
          {findPlay.description && (
            <div className="text-xs text-muted-foreground">{findPlay.description}</div>
          )}
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      </button>

      {/* Host action — for players who organize, not just attend. */}
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
