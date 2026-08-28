import { MoreVertical, Settings, Grid3X3, RefreshCw, Monitor, Trash2, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger,
} from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface HostControlsMenuProps {
  /** Event status — drives which entries are shown. */
  status: "draft" | "live" | "completed" | "voided";
  /** Whether the schedule has been generated (gates the Sync action). */
  hasSchedule: boolean;
  /** Whether edit mode is currently active (disables Settings). */
  isEditMode?: boolean;

  /** Action handlers — caller wires these to existing RoundRobinDetail handlers. */
  onSettings?: () => void;
  onCourtsAndGames?: () => void;
  onRegenerateSchedule?: () => void;
  onOpenKiosk?: () => void;
  onDeleteOrVoid?: () => void;

  /** Whether the viewer can perform destructive actions (organizer or admin). */
  canDestroy?: boolean;
}

type Entry = {
  key: string;
  label: string;
  hint: string;
  icon: typeof Settings;
  onSelect: () => void;
  disabled?: boolean;
  destructive?: boolean;
};

/**
 * Overflow menu for secondary host actions.
 *
 * Desktop: compact dropdown next to the top bar.
 * Mobile: a bottom sheet with full-width 56px rows, an icon tile, and a
 *   one-line hint per action — a 3-dot dropdown anchored to the screen edge
 *   was both hard to hit and hard to read courtside.
 *
 * Items are scoped by event state — e.g. Kiosk only appears for live or
 * completed events, Regenerate only for draft, etc.
 */
export function HostControlsMenu({
  status,
  hasSchedule,
  isEditMode = false,
  onSettings,
  onCourtsAndGames,
  onRegenerateSchedule,
  onOpenKiosk,
  onDeleteOrVoid,
  canDestroy = false,
}: HostControlsMenuProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  const entries: Entry[] = [];

  // Kiosk display is available for live AND completed events. After completion
  // hosts often keep the standings on a big screen for a while.
  if ((status === "live" || status === "completed") && onOpenKiosk) {
    entries.push({
      key: "kiosk",
      label: "Open kiosk display",
      hint: "Full-screen standings for a TV",
      icon: Monitor,
      onSelect: onOpenKiosk,
    });
  }

  if (onSettings) {
    entries.push({
      key: "settings",
      label: "Settings",
      hint: isEditMode ? "Unavailable while editing the schedule" : "Name, date, notes and rating",
      icon: Settings,
      onSelect: onSettings,
      disabled: isEditMode,
    });
  }

  // Available live too: courts often free up mid-session. Scored rounds are
  // preserved; only upcoming rounds get rebuilt.
  if ((status === "draft" || status === "live") && onCourtsAndGames) {
    entries.push({
      key: "courts",
      label: "Courts & games",
      hint: "Adjust courts or games per player",
      icon: Grid3X3,
      onSelect: onCourtsAndGames,
    });
  }

  if (status === "draft" && hasSchedule && onRegenerateSchedule) {
    entries.push({
      key: "regen",
      label: "Regenerate schedule",
      hint: "Rebuild all rounds from the roster",
      icon: RefreshCw,
      onSelect: onRegenerateSchedule,
    });
  }

  if (canDestroy && onDeleteOrVoid) {
    entries.push({
      key: "destroy",
      label: status === "completed" ? "Void event" : "Cancel event",
      hint: status === "completed" ? "Removes results from ratings" : "This can't be undone",
      icon: Trash2,
      onSelect: onDeleteOrVoid,
      destructive: true,
    });
  }

  const trigger = (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Host controls"
      className="h-11 w-11 text-secondary-foreground hover:bg-secondary-foreground/10 flex-shrink-0"
    >
      <MoreVertical className="h-5 w-5" />
    </Button>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>{trigger}</DrawerTrigger>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="text-left pb-1 pt-3">
            <DrawerTitle className="text-lg font-bold">Event controls</DrawerTitle>
          </DrawerHeader>
          <div className="px-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] space-y-1.5 overflow-y-auto">
            {entries.map((e) => {
              const Icon = e.icon;
              return (
                <button
                  key={e.key}
                  type="button"
                  disabled={e.disabled}
                  onClick={() => { setOpen(false); e.onSelect(); }}
                  className={cn(
                    "w-full min-h-[56px] flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 text-left transition-transform active:scale-[0.99] disabled:opacity-50",
                    e.destructive && "border-destructive/30",
                  )}
                >
                  <div className={cn(
                    "h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0",
                    e.destructive ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary",
                  )}>
                    <Icon className="h-[18px] w-[18px]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={cn(
                      "text-sm font-semibold leading-tight",
                      e.destructive && "text-destructive",
                    )}>
                      {e.label}
                    </div>
                    <div className="text-[11px] text-muted-foreground leading-snug truncate">
                      {e.hint}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </button>
              );
            })}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Event controls
        </DropdownMenuLabel>

        {entries.map((e) => {
          const Icon = e.icon;
          return (
            <div key={e.key}>
              {e.destructive && <DropdownMenuSeparator />}
              <DropdownMenuItem
                onClick={e.onSelect}
                disabled={e.disabled}
                className={cn(
                  "gap-2 cursor-pointer",
                  e.destructive && "text-destructive focus:text-destructive",
                )}
              >
                <Icon className="h-4 w-4" />
                {e.label}
              </DropdownMenuItem>
            </div>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
