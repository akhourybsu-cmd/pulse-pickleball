import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { UserCog, HelpCircle, UserPlus, Settings, RefreshCw, CalendarDays } from "lucide-react";

interface HomeFooterUtilitiesProps {
  isAdmin: boolean;
  onShare: () => void;
  onRefreshStats?: () => void;
  refreshing?: boolean;
}

export const HomeFooterUtilities = ({ 
  isAdmin, 
  onShare, 
  onRefreshStats,
  refreshing = false 
}: HomeFooterUtilitiesProps) => {
  const navigate = useNavigate();

  return (
    <div className="space-y-4 pt-4 border-t border-border/50">
      {/* Main Utilities Row - Flat, de-emphasized */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button
            onClick={() => navigate("/profile/edit")}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted/50"
          >
            Edit Profile
          </button>
          <span className="text-muted-foreground/30">•</span>
          <button
            onClick={() => navigate("/faq")}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted/50"
          >
            Help & FAQ
          </button>
        </div>
        
        {/* Invite Friends - Primary CTA */}
        <Button 
          onClick={onShare}
          size="sm"
          className="gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
        >
          <UserPlus className="h-3.5 w-3.5" />
          Invite Friends
        </Button>
      </div>

      {/* Admin Controls - Compact row */}
      {isAdmin && (
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/30">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mr-1">Admin</span>
          
          <button 
            onClick={() => navigate("/session/queue")}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted/50"
          >
            Queue
          </button>
          
          <button 
            onClick={() => navigate("/events")}
            data-tour="events"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted/50 flex items-center gap-1"
          >
            <CalendarDays className="w-3 h-3" />
            Events
          </button>

          {onRefreshStats && (
            <button 
              onClick={onRefreshStats}
              disabled={refreshing}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted/50 flex items-center gap-1 disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
              Recalc
            </button>
          )}
          
          <button 
            onClick={() => navigate("/admin")}
            className="text-xs text-primary hover:text-primary/80 transition-colors px-2 py-1 rounded-md hover:bg-primary/10 flex items-center gap-1 ml-auto"
          >
            <Settings className="w-3 h-3" />
            Dashboard
          </button>
        </div>
      )}
    </div>
  );
};
