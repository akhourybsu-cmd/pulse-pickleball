import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MapPin, Star, Settings, ChevronRight } from "lucide-react";
import { CircularProgressRing } from "@/components/profile/CircularProgressRing";
import { AnimatedStatChip } from "@/components/profile/AnimatedStatChip";
import { placementStatus } from "@/lib/rating/placementStatus";
import { cn } from "@/lib/utils";

interface PlayerIdentityCardProps {
  userId: string | undefined;
  fullName: string | null;
  displayName: string | null;
  avatarUrl?: string | null;
  location?: string | null;
  currentRating: number | undefined;
  totalMatches: number | undefined;
  wins: number | undefined;
  losses: number | undefined;
}

export const PlayerIdentityCard = ({
  fullName,
  displayName,
  avatarUrl,
  location,
  currentRating,
  totalMatches = 0,
  wins = 0,
  losses = 0,
}: PlayerIdentityCardProps) => {
  const navigate = useNavigate();
  const name = displayName || fullName || "Player";
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const winRate = wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0;
  const hasRating = currentRating !== undefined && currentRating > 0;
  const placement = placementStatus(totalMatches);

  return (
    <section
      aria-label="Player overview"
      className={cn(
        "relative overflow-hidden rounded-[22px] border border-border/65 bg-card p-4 sm:p-5 lg:rounded-[26px] lg:px-7 lg:py-6",
        "shadow-[0_18px_50px_-36px_hsl(var(--foreground)/0.45)] opacity-0 animate-fade-up",
      )}
      style={{ animationDelay: "50ms", animationFillMode: "forwards" }}
    >
      <div className="absolute inset-x-5 top-0 h-px bg-primary/60 lg:inset-x-7" />

      <div className="relative lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.95fr)_74px] lg:items-center lg:gap-7">
        <div className="flex min-w-0 items-start gap-3 sm:gap-4">
          <button
            type="button"
            onClick={() => navigate("/player/profile")}
            aria-label="Open your profile"
            className="flex-shrink-0 rounded-full opacity-0 animate-scale-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card"
            style={{ animationDelay: "80ms", animationFillMode: "forwards" }}
          >
            <Avatar className="h-14 w-14 ring-2 ring-primary/45 shadow-[0_8px_24px_-14px_hsl(var(--foreground)/0.55)] transition-[transform,box-shadow] duration-200 hover:scale-[1.025] hover:shadow-[0_12px_28px_-14px_hsl(var(--foreground)/0.55)] active:scale-[0.98] min-[360px]:h-16 min-[360px]:w-16 sm:h-[72px] sm:w-[72px] lg:h-20 lg:w-20 motion-reduce:transform-none">
              <AvatarImage src={avatarUrl || undefined} alt={name} />
              <AvatarFallback className="bg-primary/15 text-base font-bold text-primary min-[360px]:text-lg sm:text-xl">
                {initials}
              </AvatarFallback>
            </Avatar>
          </button>

          <div
            className="flex min-w-0 flex-1 flex-col gap-1.5 opacity-0 animate-fade-up"
            style={{ animationDelay: "120ms", animationFillMode: "forwards" }}
          >
            <span className="hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground lg:block">
              Player overview
            </span>
            <button
              type="button"
              className="group flex w-fit max-w-full items-center gap-1 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card"
              onClick={() => navigate("/player/profile")}
            >
              <h1 className="line-clamp-2 font-display text-xl font-bold leading-tight tracking-[-0.025em] text-foreground transition-colors group-hover:text-primary/90 sm:text-2xl lg:text-[28px]">
                {name}
              </h1>
              <ChevronRight className="hidden h-4 w-4 flex-shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 sm:block motion-reduce:transform-none" />
            </button>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => navigate("/player/pulse")}
                aria-label={
                  placement.isPreliminary
                    ? `Preliminary rating, placement ${placement.played} of ${placement.total} matches`
                    : "View your Player Pulse analytics"
                }
                className="inline-flex min-h-7 w-fit items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 py-1 pl-2 pr-3 text-primary transition-[transform,background-color] hover:bg-primary/15 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card"
              >
                <Star className="h-3.5 w-3.5 fill-primary" />
                <span className="text-sm font-bold tabular-nums tracking-tight">
                  {hasRating ? currentRating.toFixed(2) : "—"}
                </span>
                <span className="text-[11px] font-medium uppercase tracking-wider text-primary/80">
                  {placement.isPreliminary ? "Preliminary" : hasRating ? "PULSE" : "No Rating"}
                </span>
              </button>
              {placement.isPreliminary && (
                <span
                  className="inline-flex items-center rounded-full bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground"
                  title="Your first 5 matches place you at your true level"
                >
                  Placement · {placement.played} of {placement.total}
                </span>
              )}
            </div>

            {location ? (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate text-sm">{location}</span>
              </div>
            ) : (
              <button
                type="button"
                className="group flex min-h-7 w-fit items-center gap-1.5 rounded-md text-muted-foreground/70 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                onClick={() => navigate("/player/profile/edit?focus=location")}
              >
                <Settings className="h-3.5 w-3.5 transition-transform group-hover:rotate-45 motion-reduce:transform-none" />
                <span className="text-sm">Add location</span>
              </button>
            )}
          </div>

          <div
            className="hidden flex-shrink-0 opacity-0 animate-scale-in min-[360px]:block lg:hidden"
            style={{ animationDelay: "160ms", animationFillMode: "forwards" }}
          >
            <CircularProgressRing percentage={winRate} size={60} strokeWidth={5} />
          </div>
        </div>

        <div className="my-3 border-t border-border/45 lg:hidden" />

        <div className="grid grid-cols-2 gap-2 min-[390px]:grid-cols-4 lg:grid-cols-4 lg:gap-2.5">
          <AnimatedStatChip label="Rating" value={hasRating ? currentRating : "—"} decimals={2} isPrimary delay={200} />
          <AnimatedStatChip label="Matches" value={totalMatches || 0} delay={240} />
          <AnimatedStatChip label="Win %" value={winRate} suffix="%" delay={280} />
          <AnimatedStatChip label="Record" value={`${wins}-${losses}`} delay={320} />
        </div>

        <div
          className="hidden justify-self-end opacity-0 animate-scale-in lg:block"
          style={{ animationDelay: "160ms", animationFillMode: "forwards" }}
        >
          <CircularProgressRing percentage={winRate} size={68} strokeWidth={5} />
        </div>
      </div>
    </section>
  );
};
