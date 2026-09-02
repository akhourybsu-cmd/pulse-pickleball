import { useNavigate } from "react-router-dom";
import { Plus, Compass, Repeat, ArrowUpRight, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickAction {
  label: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  tourTag: string;
}

/** The player dashboard's three highest-value actions. */
export const QuickActionsBar = () => {
  const navigate = useNavigate();

  const recordMatch: QuickAction = {
    label: "Record Match",
    description: "Log a casual game",
    icon: <Plus className="h-5 w-5" strokeWidth={2.5} />,
    path: "/player/matches/new",
    tourTag: "record-match",
  };

  const findPlay: QuickAction = {
    label: "Find Play",
    description: "Round robins, open play, clinics, and leagues nearby",
    icon: <Compass className="h-5 w-5" />,
    path: "/player/play",
    tourTag: "find-play",
  };

  const secondaryClass = cn(
    "group relative flex min-h-[94px] w-full flex-col items-start rounded-2xl border border-border/65 bg-card px-3.5 py-3 text-left sm:px-4",
    "md:min-h-[96px] md:flex-row md:items-center md:gap-3",
    "shadow-[0_8px_24px_-22px_hsl(var(--foreground)/0.5)] transition-[transform,border-color,background-color,box-shadow] duration-200 ease-out",
    "hover:-translate-y-0.5 hover:border-primary/35 hover:bg-card hover:shadow-[0_12px_28px_-20px_hsl(var(--foreground)/0.5)] active:translate-y-0 active:scale-[0.985]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transform-none",
  );

  return (
    <div
      className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-[1.12fr_1fr_1fr]"
      data-tour="quick-actions"
    >
      <button
        type="button"
        onClick={() => navigate(recordMatch.path)}
        data-tour={recordMatch.tourTag}
        className={cn(
          "group col-span-2 flex min-h-[76px] w-full items-center gap-3 rounded-2xl bg-primary px-4 py-3.5 text-left text-primary-foreground md:col-span-1 md:min-h-[96px] md:px-5",
          "shadow-[0_10px_26px_-16px_hsl(var(--primary)/0.85)] transition-[transform,background-color,box-shadow] duration-200 ease-out",
          "hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-[0_15px_30px_-17px_hsl(var(--primary)/0.9)] active:translate-y-0 active:scale-[0.985]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transform-none",
        )}
      >
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-primary-foreground/15 bg-primary-foreground/15 transition-transform duration-200 group-hover:scale-105 motion-reduce:transform-none">
          {recordMatch.icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold tracking-tight sm:text-base">{recordMatch.label}</div>
          <div className="mt-0.5 text-xs text-primary-foreground/80">{recordMatch.description}</div>
        </div>
        <ArrowUpRight className="h-4 w-4 flex-shrink-0 opacity-70 transition-[transform,opacity] group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:opacity-100 motion-reduce:transform-none" />
      </button>

      <button
        type="button"
        onClick={() => navigate(findPlay.path)}
        data-tour={findPlay.tourTag}
        className={secondaryClass}
      >
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
          {findPlay.icon}
        </div>
        <div className="mt-2 min-w-0 flex-1 md:mt-0">
          <div className="text-sm font-semibold tracking-tight text-foreground">{findPlay.label}</div>
          <div className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-muted-foreground md:text-xs">
            {findPlay.description}
          </div>
        </div>
        <ChevronRight className="absolute right-3 top-3 h-4 w-4 flex-shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 md:static motion-reduce:transform-none" />
      </button>

      <button
        type="button"
        onClick={() => navigate("/round-robin/create")}
        data-tour="host-round-robin"
        className={secondaryClass}
      >
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
          <Repeat className="h-4 w-4" />
        </div>
        <div className="mt-2 min-w-0 flex-1 md:mt-0">
          <div className="text-sm font-semibold tracking-tight text-foreground">Host a Round Robin</div>
          <div className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-muted-foreground md:text-xs">
            Set up rotating play with auto-scheduling
          </div>
        </div>
        <ChevronRight className="absolute right-3 top-3 h-4 w-4 flex-shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 md:static motion-reduce:transform-none" />
      </button>
    </div>
  );
};
