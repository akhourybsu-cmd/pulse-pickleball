import { MoreVertical, Settings, Grid3X3, RefreshCw, Monitor, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface HostControlsMenuProps {
  /** Event status — drives which entries are shown. */
  status: "draft" | "live" | "completed";
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

/**
 * Overflow menu for secondary host actions.
 *
 * Replaces the previous row of inline buttons (Settings · Courts & Games ·
 * Sync · Kiosk · Delete) that ate prime hero space. The primary "what to
 * do next" action lives in the WhatsNextBanner; everything else lives
 * here, one tap away.
 *
 * Mobile-first: appears as a 3-dot icon button at the right of the top bar.
 * Items are scoped by event state — e.g. Kiosk only appears for live
 * events, Courts & Games only for draft, etc.
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
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Host controls"
          className="h-9 w-9 text-secondary-foreground hover:bg-secondary-foreground/10 flex-shrink-0"
        >
          <MoreVertical className="h-[18px] w-[18px]" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Event controls
        </DropdownMenuLabel>

        {status === "live" && onOpenKiosk && (
          <DropdownMenuItem onClick={onOpenKiosk} className="gap-2 cursor-pointer">
            <Monitor className="h-4 w-4" />
            Open kiosk display
          </DropdownMenuItem>
        )}

        {onSettings && (
          <DropdownMenuItem
            onClick={onSettings}
            disabled={isEditMode}
            className="gap-2 cursor-pointer"
          >
            <Settings className="h-4 w-4" />
            Settings
          </DropdownMenuItem>
        )}

        {status === "draft" && onCourtsAndGames && (
          <DropdownMenuItem onClick={onCourtsAndGames} className="gap-2 cursor-pointer">
            <Grid3X3 className="h-4 w-4" />
            Courts &amp; games
          </DropdownMenuItem>
        )}

        {status === "draft" && hasSchedule && onRegenerateSchedule && (
          <DropdownMenuItem onClick={onRegenerateSchedule} className="gap-2 cursor-pointer">
            <RefreshCw className="h-4 w-4" />
            Regenerate schedule
          </DropdownMenuItem>
        )}

        {canDestroy && onDeleteOrVoid && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onDeleteOrVoid}
              className="gap-2 cursor-pointer text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              {status === "completed" ? "Void event" : "Cancel event"}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
