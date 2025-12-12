import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { UserCog, HelpCircle, Share2, Settings, RefreshCw, CalendarDays } from "lucide-react";

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
        <CardContent className="p-4 md:p-6">
          <div className="flex flex-col md:flex-row gap-3 items-stretch">
            {/* Left: Edit Profile and Help & FAQ */}
            <div className="flex-1 flex flex-col sm:flex-row gap-3">
              <Button
                size="lg" 
                variant="subtle"
                onClick={() => navigate("/profile/edit")}
                className="flex-1 rounded-xl gap-1.5 h-11"
              >
                <UserCog className="w-4 h-4 stroke-[2.5]" />
                Edit Profile
              </Button>

              <Button 
                size="lg" 
                variant="subtle"
                onClick={() => navigate("/faq")}
                className="flex-1 rounded-xl gap-1.5 h-11"
              >
                <HelpCircle className="w-4 h-4 stroke-[2.5]" />
                Help & FAQ
              </Button>
            </div>

            {/* Right: Invite Friends */}
            <Button 
              onClick={onShare}
              variant="default"
              size="lg"
              className="gap-2 md:w-auto shadow-[var(--shadow-glow)] h-11"
            >
              <Share2 className="h-4 w-4" />
              Invite Friends
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Admin Controls */}
      {isAdmin && (
        <Card className="bg-gradient-to-br from-muted/30 to-background">
          <CardContent className="p-4 md:p-6">
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
              size="lg"
              onClick={() => navigate("/admin")}
              className="w-full mt-3 h-11"
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
