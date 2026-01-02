import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format, isToday, isTomorrow, differenceInHours } from "date-fns";
import { 
  AlertCircle, 
  Calendar, 
  ChevronRight, 
  CheckCircle2,
  Clock,
  Bell
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MatchVerificationDialog } from "./MatchVerificationDialog";

interface ActionItem {
  id: string;
  type: "verify_match" | "event_soon" | "booking_soon" | "check_in";
  title: string;
  description: string;
  link: string;
  matchId?: string;
  urgency: "high" | "medium" | "low";
  timestamp?: string;
}

interface SystemUpdate {
  id: string;
  type: "match_recorded" | "event_confirmed" | "rating_updated";
  title: string;
  description: string;
  timestamp: string;
  link?: string;
}

interface ActivityModuleProps {
  userId: string | undefined;
}

export const ActivityModule = ({ userId }: ActivityModuleProps) => {
  const navigate = useNavigate();
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [alerts, setAlerts] = useState<ActionItem[]>([]);
  const [systemUpdates, setSystemUpdates] = useState<SystemUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;

    const fetchActivity = async () => {
      setLoading(true);
      const actions: ActionItem[] = [];
      const timeAlerts: ActionItem[] = [];
      const updates: SystemUpdate[] = [];

      // 1. Fetch pending match verifications (matches where user is participant but hasn't verified)
      const { data: pendingMatches } = await supabase
        .from("match_participants")
        .select(`
          match_id,
          match:matches!inner (
            id,
            match_date,
            team1_score,
            team2_score,
            status,
            verified_by,
            created_at
          )
        `)
        .eq("player_id", userId)
        .eq("matches.status", "pending");

      if (pendingMatches) {
        for (const p of pendingMatches) {
          const match = p.match as any;
          // Check if user hasn't verified yet
          const verifiedBy = match.verified_by || [];
          if (!verifiedBy.includes(userId)) {
            actions.push({
              id: `verify-${match.id}`,
              type: "verify_match",
              title: "Verify Match Result",
              description: `${match.team1_score}-${match.team2_score} on ${format(new Date(match.match_date), "MMM d")}`,
              link: `/match/history`,
              matchId: match.id,
              urgency: "high",
              timestamp: match.created_at,
            });
          }
        }
      }

      // 2. Fetch upcoming round robin events (within 48 hours)
      const now = new Date();
      const in48Hours = new Date(now.getTime() + 48 * 60 * 60 * 1000);
      
      const { data: upcomingRREvents } = await supabase
        .from("round_robin_players")
        .select(`
          event:round_robin_events!inner (
            id,
            name,
            date,
            start_time,
            location
          )
        `)
        .eq("player_id", userId)
        .eq("active", true)
        .gte("round_robin_events.date", now.toISOString().split("T")[0])
        .lte("round_robin_events.date", in48Hours.toISOString().split("T")[0]);

      if (upcomingRREvents) {
        for (const reg of upcomingRREvents) {
          const event = reg.event as any;
          const eventDate = new Date(event.date);
          const hoursUntil = differenceInHours(eventDate, now);
          
          timeAlerts.push({
            id: `event-${event.id}`,
            type: "event_soon",
            title: event.name,
            description: isToday(eventDate) 
              ? `Today${event.start_time ? ` at ${event.start_time}` : ''}`
              : isTomorrow(eventDate)
              ? `Tomorrow${event.start_time ? ` at ${event.start_time}` : ''}`
              : format(eventDate, "EEE, MMM d"),
            link: `/round-robin/${event.id}`,
            urgency: hoursUntil < 12 ? "high" : "medium",
            timestamp: event.date,
          });
        }
      }

      // 3. Fetch upcoming venue bookings (within 24 hours)
      const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      
      const { data: upcomingBookings } = await supabase
        .from("venue_bookings")
        .select(`
          id,
          start_time,
          venue:venues (name)
        `)
        .eq("user_id", userId)
        .eq("status", "confirmed")
        .gte("start_time", now.toISOString())
        .lte("start_time", in24Hours.toISOString());

      if (upcomingBookings) {
        for (const booking of upcomingBookings) {
          const startTime = new Date(booking.start_time);
          const hoursUntil = differenceInHours(startTime, now);
          
          timeAlerts.push({
            id: `booking-${booking.id}`,
            type: "booking_soon",
            title: "Court Reservation",
            description: `${(booking.venue as any)?.name || 'Venue'} - ${format(startTime, "h:mm a")}`,
            link: "/player/bookings",
            urgency: hoursUntil < 2 ? "high" : "medium",
            timestamp: booking.start_time,
          });
        }
      }

      // 4. Fetch recent system updates (last 7 days) - recently approved matches
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      const { data: recentApprovedMatches } = await supabase
        .from("match_participants")
        .select(`
          match:matches!inner (
            id,
            match_date,
            team1_score,
            team2_score,
            status,
            updated_at
          ),
          rating_change
        `)
        .eq("player_id", userId)
        .eq("matches.status", "approved")
        .gte("matches.updated_at", sevenDaysAgo.toISOString())
        .order("created_at", { ascending: false })
        .limit(5);

      if (recentApprovedMatches) {
        for (const p of recentApprovedMatches) {
          const match = p.match as any;
          updates.push({
            id: `approved-${match.id}`,
            type: "match_recorded",
            title: "Match Recorded",
            description: `${match.team1_score}-${match.team2_score}${p.rating_change ? ` (${p.rating_change > 0 ? '+' : ''}${p.rating_change.toFixed(2)})` : ''}`,
            timestamp: match.updated_at,
            link: "/match/history",
          });
        }
      }

      // 5. Fetch recent event confirmations
      const { data: recentEventRegs } = await supabase
        .from("round_robin_players")
        .select(`
          id,
          joined_at,
          event:round_robin_events (
            id,
            name,
            date
          )
        `)
        .eq("player_id", userId)
        .eq("active", true)
        .gte("joined_at", sevenDaysAgo.toISOString())
        .order("joined_at", { ascending: false })
        .limit(3);

      if (recentEventRegs) {
        for (const reg of recentEventRegs) {
          const event = reg.event as any;
          if (event) {
            updates.push({
              id: `reg-${reg.id}`,
              type: "event_confirmed",
              title: "Event Registration",
              description: `Registered for ${event.name}`,
              timestamp: reg.joined_at,
              link: `/round-robin/${event.id}`,
            });
          }
        }
      }

      // Sort by timestamp/urgency
      actions.sort((a, b) => (a.urgency === "high" ? -1 : 1));
      timeAlerts.sort((a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime());
      updates.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      setActionItems(actions);
      setAlerts(timeAlerts);
      setSystemUpdates(updates.slice(0, 5));
      setLoading(false);
    };

    fetchActivity();
  }, [userId]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-muted rounded w-1/3"></div>
          <div className="h-16 bg-muted rounded-xl"></div>
          <div className="h-16 bg-muted rounded-xl"></div>
        </div>
      </div>
    );
  }

  const hasContent = actionItems.length > 0 || alerts.length > 0 || systemUpdates.length > 0;

  if (!hasContent) {
    return (
      <div className="text-center py-8">
        <CheckCircle2 className="w-10 h-10 text-primary/50 mx-auto mb-3" />
        <p className="text-sm font-medium text-foreground">All caught up!</p>
        <p className="text-xs text-muted-foreground mt-1">
          No pending actions or upcoming events
        </p>
      </div>
    );
  }

  const handleActionClick = (item: ActionItem) => {
    if (item.type === "verify_match" && item.matchId) {
      setSelectedMatchId(item.matchId);
      setVerifyDialogOpen(true);
    } else {
      navigate(item.link);
    }
  };

  const handleMatchVerified = (matchId: string) => {
    setActionItems((prev) => prev.filter((item) => item.matchId !== matchId));
  };

  return (
    <div className="space-y-5">
      {/* Match Verification Dialog */}
      <MatchVerificationDialog
        matchId={selectedMatchId}
        open={verifyDialogOpen}
        onOpenChange={setVerifyDialogOpen}
        onVerified={handleMatchVerified}
      />

      {/* Action Required Section */}
      {actionItems.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-4 h-4 text-destructive" />
            <h3 className="text-sm font-medium text-destructive">Action Required</h3>
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
              {actionItems.length}
            </Badge>
          </div>
          <div className="space-y-2">
            {actionItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleActionClick(item)}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-destructive/10 hover:bg-destructive/15 border border-destructive/30 transition-colors text-left"
              >
                <div className="w-9 h-9 rounded-full bg-destructive/20 flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-4 h-4 text-destructive" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{item.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-destructive flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Time-Sensitive Alerts */}
      {alerts.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-medium text-muted-foreground">Coming Up</h3>
          </div>
          <div className="space-y-2">
            {alerts.map((item) => (
              <button
                key={item.id}
                onClick={() => navigate(item.link)}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-primary/5 hover:bg-primary/10 border border-primary/20 transition-colors text-left"
              >
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* System Updates Feed */}
      {systemUpdates.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Bell className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-medium text-muted-foreground">Recent Updates</h3>
          </div>
          <div className="space-y-1">
            {systemUpdates.map((update) => (
              <button
                key={update.id}
                onClick={() => update.link && navigate(update.link)}
                className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors text-left"
              >
                <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                  {update.type === "match_recorded" && <CheckCircle2 className="w-3.5 h-3.5 text-primary" />}
                  {update.type === "event_confirmed" && <Calendar className="w-3.5 h-3.5 text-primary" />}
                  {update.type === "rating_updated" && <Bell className="w-3.5 h-3.5 text-primary" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">{update.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{update.description}</p>
                </div>
                <span className="text-[10px] text-muted-foreground flex-shrink-0">
                  {format(new Date(update.timestamp), "MMM d")}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
