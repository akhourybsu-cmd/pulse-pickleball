import { CalendarDays, Expand, Minimize, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  VenueBrandMark,
  type VenueIdentity,
} from "@/components/venue/VenueBrandMark";
import { formatSlotTime } from "@/lib/venues/availability";
import { cn } from "@/lib/utils";

export function VenueOpsHeader({
  identity,
  timeZone,
  now,
  kiosk,
  view,
  onViewChange,
  onToggleKiosk,
}: {
  identity: VenueIdentity;
  timeZone?: string | null;
  now: Date;
  kiosk: boolean;
  view: "attendance" | "courts";
  onViewChange: (view: "attendance" | "courts") => void;
  onToggleKiosk: () => void;
}) {
  return (
    <header
      className={cn(
        kiosk
          ? "sticky top-0 z-40 border-b border-t-4 border-t-primary bg-card text-card-foreground shadow-sm"
          : "mb-6"
      )}
    >
      <div
        className={cn(
          kiosk &&
            "mx-auto max-w-[1680px] px-4 pt-[calc(1rem+env(safe-area-inset-top))] sm:px-6 lg:px-8"
        )}
      >
        {kiosk && (
          <div className="flex items-center justify-between gap-4 pb-4">
            <div className="flex min-w-0 items-center gap-3 sm:gap-4">
              <VenueBrandMark
                {...identity}
                className="h-14 w-14 text-[56px] ring-1 ring-border/60 sm:h-16 sm:w-16 sm:text-[64px]"
              />
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Front desk{" "}
                  <span className="hidden sm:inline">· Staff kiosk</span>
                </p>
                <h1 className="mt-1 break-words text-lg font-semibold leading-tight tracking-tight sm:text-2xl">
                  {identity.name}
                </h1>
              </div>
            </div>
            <div
              className="hidden shrink-0 border-l pl-6 text-right md:block"
              aria-label="Current venue time"
            >
              <p className="text-2xl font-semibold tabular-nums tracking-tight">
                {formatSlotTime(now, timeZone)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {now.toLocaleDateString([], {
                  timeZone: timeZone ?? undefined,
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}{" "}
                · Venue time
              </p>
            </div>
            <Button
              variant="outline"
              className="h-11 shrink-0 rounded-xl px-3 md:ml-2"
              onClick={onToggleKiosk}
              aria-label="Exit kiosk"
            >
              <Minimize className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Exit kiosk</span>
            </Button>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav
            className={cn("flex min-w-0 gap-2", kiosk && "w-full sm:w-auto")}
            aria-label="Operations workspace"
          >
            {(
              [
                {
                  value: "attendance",
                  label: "Check-in desk",
                  icon: UserCheck,
                },
                {
                  value: "courts",
                  label: "Court calendar",
                  icon: CalendarDays,
                },
              ] as const
            ).map(({ value, label, icon: Icon }) => (
              <Button
                key={value}
                variant={
                  kiosk ? "ghost" : view === value ? "default" : "outline"
                }
                className={cn(
                  "h-12 gap-2",
                  kiosk &&
                    "relative flex-1 rounded-none px-3 text-muted-foreground hover:bg-muted/50 sm:flex-none sm:px-5",
                  kiosk &&
                    view === value &&
                      "text-foreground after:absolute after:inset-x-3 after:bottom-0 after:h-[3px] after:rounded-t-full after:bg-ring"
                )}
                aria-pressed={view === value}
                onClick={() => onViewChange(value)}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Button>
            ))}
          </nav>
          {!kiosk && (
            <Button className="h-11" variant="outline" onClick={onToggleKiosk}>
              <Expand className="mr-2 h-4 w-4" />
              Open staff kiosk
            </Button>
          )}
          {kiosk && (
            <p className="hidden text-xs text-muted-foreground lg:block">
              Player arrivals & court operations
            </p>
          )}
        </div>
      </div>
    </header>
  );
}
