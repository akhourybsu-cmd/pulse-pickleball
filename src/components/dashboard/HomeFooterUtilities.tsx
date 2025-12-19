import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
    <div className="space-y-4">
      {/* Main Utilities */}
      <Card className="bg-gradient-to-br from-muted/30 to-background">
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground mb-3">Settings</p>
          <div className="flex flex-col gap-3">
            {/* Top Row: Edit Profile and Help & FAQ side by side - outline style */}
            <div className="flex gap-3">
              <Button
                size="default" 
                variant="outline"
                onClick={() => navigate("/profile/edit")}
                className="flex-1 rounded-xl gap-2 h-10"
              >
                <UserCog className="w-4 h-4" />
                Edit Profile
              </Button>

              <Button 
                size="default" 
                variant="outline"
                onClick={() => navigate("/faq")}
                className="flex-1 rounded-xl gap-2 h-10"
              >
                <HelpCircle className="w-4 h-4" />
                Help & FAQ
              </Button>
            </div>

            {/* Bottom Row: Invite Friends - gradient CTA */}
            <Button 
              onClick={onShare}
              size="default"
              className="w-full gap-2 h-11 bg-gradient-to-r from-primary to-[hsl(74_65%_62%)] hover:from-primary/90 hover:to-[hsl(74_65%_62%/0.9)] text-primary-foreground shadow-[var(--shadow-glow)]"
            >
              <UserPlus className="h-4 w-4" />
              Invite Friends
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Admin Controls */}
      {isAdmin && (
        <Card className="bg-gradient-to-br from-muted/30 to-background">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-3">Admin Controls</p>
            <div className="grid gap-3 md:grid-cols-3">
              <Button 
                size="default" 
                variant="outline"
                onClick={() => navigate("/session/queue")}
                className="h-10"
              >
                Session Queue
              </Button>
              
              <Button 
                size="default" 
                variant="outline"
                onClick={() => navigate("/events")}
                data-tour="events"
                className="h-10"
              >
                <CalendarDays className="w-4 h-4 mr-2" />
                Events
              </Button>

              {onRefreshStats && (
                <Button 
                  variant="outline" 
                  size="default"
                  onClick={onRefreshStats}
                  disabled={refreshing}
                  className="h-10"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                  Recalculate
                </Button>
              )}
            </div>
            
            <Button 
              variant="default" 
              size="default"
              onClick={() => navigate("/admin")}
              className="w-full mt-3 h-10"
            >
              <Settings className="w-4 h-4 mr-2" />
              Admin Dashboard
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
