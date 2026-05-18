import { useNavigate } from "react-router-dom";
import { Building2, ChevronRight, Shield } from "lucide-react";
import { useMode } from "@/contexts/ModeContext";
import { cn } from "@/lib/utils";

interface RoleSwitcherCardProps {
  /** Whether the current user is a platform admin (passed from Dashboard so we don't re-query). */
  isAdmin?: boolean;
}

/**
 * Tasteful role-aware shortcut shown on the Player Dashboard.
 *
 * - Players-only users see nothing (component returns null).
 * - Users with venue access see a small "Manage your venue" card.
 * - Platform admins additionally see an admin shortcut.
 *
 * The intent is to surface organizer/admin entry points WITHOUT cluttering the
 * player-first dashboard. Tap the card → switch into Venue Mode and route to
 * /venue (the same flow PublicVenueLanding's "Manage this Venue" button uses).
 */
export function RoleSwitcherCard({ isAdmin = false }: RoleSwitcherCardProps) {
  const navigate = useNavigate();
  const { venueAccess, setMode, setCurrentVenueId } = useMode();

  const hasVenueAccess = venueAccess.length > 0;

  // Nothing to show — pure player. Don't clutter the dashboard.
  if (!hasVenueAccess && !isAdmin) {
    return null;
  }

  const handleOpenVenueConsole = () => {
    const primary = venueAccess[0];
    if (!primary) return;
    setCurrentVenueId(primary.venue_id);
    setMode("venue");
    navigate("/venue");
  };

  return (
    <div className="space-y-2">
      {hasVenueAccess && (
        <button
          onClick={handleOpenVenueConsole}
          className={cn(
            "w-full flex items-center gap-3 px-4 py-3 rounded-xl",
            "bg-card border border-border/60 text-left",
            "hover:border-primary/40 hover:bg-muted/30 active:scale-[0.99]",
            "transition-all duration-200 ease-out"
          )}
        >
          <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
            <Building2 className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-foreground">
              You also manage {venueAccess.length === 1 ? "a venue" : `${venueAccess.length} venues`}
            </div>
            <div className="text-xs text-muted-foreground truncate">
              {venueAccess.length === 1
                ? `Open ${venueAccess[0].venue_name} console`
                : "Open Venue Console"}
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        </button>
      )}

      {isAdmin && (
        <button
          onClick={() => navigate("/admin")}
          className={cn(
            "w-full flex items-center gap-3 px-4 py-3 rounded-xl",
            "bg-card border border-border/60 text-left",
            "hover:border-primary/40 hover:bg-muted/30 active:scale-[0.99]",
            "transition-all duration-200 ease-out"
          )}
        >
          <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
            <Shield className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-foreground">Platform admin tools</div>
            <div className="text-xs text-muted-foreground">Open admin dashboard</div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        </button>
      )}
    </div>
  );
}
