import {
  MoreVertical, Settings, Grid3X3, RefreshCw, Monitor, Trash2, ChevronRight,
  ArrowLeftRight, ClipboardList, History,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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
  onEditSchedule?: () => void;
  onScoreCorrections?: () => void;
  onActivityLog?: () => void;
  onOpenKiosk?: () => void;
  onDeleteOrVoid?: () => void;

  /** Whether the viewer can perform destructive actions (organizer or admin). */
  canDestroy?: boolean;
}

type GroupKey = "display" | "setup" | "matches" | "danger";

type Entry = {
  key: string;
  group: GroupKey;
  label: string;
  hint: string;
  icon: typeof Settings;
  onSelect: () => void;
  disabled?: boolean;
  destructive?: boolean;
};

const GROUP_LABELS: Record<GroupKey, string> = {
  display: "Display",
  setup: "Event setup",
  matches: "Matches & history",
  danger: "Danger zone",
};

const GROUP_ORDER: GroupKey[] = ["display", "setup", "matches", "danger"];

/**
 * Overflow menu for secondary host actions.
 *
 * Desktop: compact dropdown next to the top bar.
 * Mobile: a bottom sheet with full-width 60px rows, an icon tile, and a
 *   one-line hint per action — a 3-dot dropdown anchored to the screen edge
 *   was both hard to hit and hard to read courtside.
 *
 * Entries are grouped (Display / Event setup / Matches & history / Danger zone)
 * so the sheet stays scannable as the host toolset grows, and every entry is
 * scoped by event state — Kiosk only for live or completed, Regenerate only for
 * draft, etc.
 */
export function HostControlsMenu({
  status,
  hasSchedule,
  isEditMode = false,
  onSettings,
  onCourtsAndGames,
  onRegenerateSchedule,
  onEditSchedule,
  onScoreCorrections,
  onActivityLog,
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
      group: "display",
      label: "Open kiosk display",
      hint: "Full-screen standings for a TV",
      icon: Monitor,
      onSelect: onOpenKiosk,
    });
  }

  if (onSettings) {
    entries.push({
      key: "settings",
      group: "setup",
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
      group: "setup",
      label: "Courts & games",
      hint: "Adjust courts or games per player",
      icon: Grid3X3,
      onSelect: onCourtsAndGames,
    });
  }

  if (status === "draft" && hasSchedule && onRegenerateSchedule) {
    entries.push({
      key: "regen",
      group: "setup",
      label: "Regenerate schedule",
      hint: "Rebuild all rounds from the roster",
      icon: RefreshCw,
      onSelect: onRegenerateSchedule,
    });
  }

  if (hasSchedule && onEditSchedule) {
    entries.push({
      key: "edit-schedule",
      group: "matches",
      label: "Schedule editor",
      hint: "Swap partners, opponents or courts",
      icon: ArrowLeftRight,
      onSelect: onEditSchedule,
    });
  }

  if (hasSchedule && onScoreCorrections) {
    entries.push({
      key: "scores",
      group: "matches",
      label: "Score corrections",
      hint: "Fix, void or delete a reported result",
      icon: ClipboardList,
      onSelect: onScoreCorrections,
    });
  }

  if (onActivityLog) {
    entries.push({
      key: "activity",
      group: "matches",
      label: "Activity log",
      hint: "Every host change, newest first",
      icon: History,
      onSelect: onActivityLog,
    });
  }

  if (canDestroy && onDeleteOrVoid) {
    entries.push({
      key: "destroy",
      group: "danger",
      label: status === "completed" ? "Void event" : "Cancel event",
      hint: status === "completed" ? "Removes results from ratings" : "This can't be undone",
      icon: Trash2,
      onSelect: onDeleteOrVoid,
      destructive: true,
    });
  }

  const groups = GROUP_ORDER
    .map((key) => ({ key, items: entries.filter((e) => e.group === key) }))
    .filter((g) => g.items.length > 0);

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

  const groupLabel = (key: GroupKey) => (
    <div className="px-1 pt-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/80">
      {GROUP_LABELS[key]}
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>{trigger}</DrawerTrigger>
        <DrawerContent className="max-h-[85vh] border-t border-border/60">
          {/* Ambient wash so the sheet feels designed, not stock */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-primary/[0.10] to-transparent"
          />
          <DrawerHeader className="relative text-left pb-2 pt-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary/80">
              Round Robin
            </div>
            <DrawerTitle className="text-[20px] font-extrabold tracking-[-0.01em]">
              Event controls
            </DrawerTitle>
          </DrawerHeader>
          <div className="relative px-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] overflow-y-auto">
            {groups.map((group) => (
              <div key={group.key}>
                {groupLabel(group.key)}
                <div className="rounded-2xl border border-border/70 bg-card/80 backdrop-blur-sm overflow-hidden divide-y divide-border/60 shadow-[0_8px_30px_-16px_hsl(var(--foreground)/0.25)]">
                  {group.items.map((e) => {
                    const Icon = e.icon;
                    return (
                      <button
                        key={e.key}
                        type="button"
                        disabled={e.disabled}
                        onClick={() => { setOpen(false); e.onSelect(); }}
                        className={cn(
                          "group w-full min-h-[60px] flex items-center gap-3 px-3.5 py-3 text-left transition-colors active:bg-muted/60 disabled:opacity-45",
                          e.destructive && "bg-destructive/[0.04]",
                        )}
                      >
                        <div className={cn(
                          "h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 border",
                          e.destructive
                            ? "bg-destructive/10 text-destructive border-destructive/25"
                            : "bg-primary/10 text-primary border-primary/20",
                        )}>
                          <Icon className="h-[18px] w-[18px]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className={cn(
                            "text-[15px] font-semibold leading-tight tracking-[-0.01em]",
                            e.destructive && "text-destructive",
                          )}>
                            {e.label}
                          </div>
                          <div className="mt-0.5 text-[11.5px] text-muted-foreground leading-snug truncate">
                            {e.hint}
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground/60 flex-shrink-0 transition-transform group-active:translate-x-0.5" />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-72 p-1.5 rounded-xl border-border/70 bg-popover/95 backdrop-blur-md shadow-[0_20px_50px_-20px_hsl(var(--foreground)/0.35)]"
      >
        <DropdownMenuLabel className="px-2 pt-1.5 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-primary/80">
          Event controls
        </DropdownMenuLabel>

        {groups.map((group) => (
          <div key={group.key}>
            <div className="px-2 pt-2 pb-1 text-[9.5px] font-bold uppercase tracking-[0.18em] text-muted-foreground/70">
              {GROUP_LABELS[group.key]}
            </div>
            <div className="rounded-lg border border-border/50 bg-card/50 overflow-hidden divide-y divide-border/40">
              {group.items.map((e) => {
                const Icon = e.icon;
                return (
                  <DropdownMenuItem
                    key={e.key}
                    onClick={e.onSelect}
                    disabled={e.disabled}
                    className={cn(
                      "gap-3 cursor-pointer rounded-none px-2 py-2 items-start focus:bg-muted/70",
                      e.destructive && "text-destructive focus:text-destructive focus:bg-destructive/10",
                    )}
                  >
                    <span className={cn(
                      "mt-0.5 h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 border",
                      e.destructive
                        ? "bg-destructive/10 text-destructive border-destructive/25"
                        : "bg-primary/10 text-primary border-primary/20",
                    )}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold leading-tight">{e.label}</span>
                      <span className="block mt-0.5 text-[11px] text-muted-foreground leading-snug">
                        {e.hint}
                      </span>
                    </span>
                  </DropdownMenuItem>
                );
              })}
            </div>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
