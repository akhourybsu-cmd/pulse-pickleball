import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useLocation } from "react-router-dom";
import { X } from "lucide-react";

interface LiveEvent {
  id: string;
  name: string;
  date: string;
  current_round: number;
  num_rounds: number;
}

export function RoundRobinBanner() {
  const [liveEvent, setLiveEvent] = useState<LiveEvent | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Check authentication status
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setIsAuthenticated(!!user);
      if (user) {
        fetchLiveEvent();
      }
    };

    checkAuth();
    
    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
      if (session) {
        fetchLiveEvent();
      } else {
        setLiveEvent(null);
      }
    });
    
    const channel = supabase
      .channel('round-robin-banner-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'round_robin_events',
          filter: `status=eq.live`
        },
        () => {
          fetchLiveEvent();
          setIsDismissed(false); // Reset dismiss state when event changes
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchLiveEvent = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get events where user is a participant and status is live
      const { data: playerEvents, error } = await supabase
        .from("round_robin_players")
        .select(`
          event_id,
          round_robin_events!inner (
            id,
            name,
            date,
            status,
            current_round,
            num_rounds
          )
        `)
        .eq("player_id", user.id)
        .eq("round_robin_events.status", "live")
        .limit(1);

      if (error) {
        console.error("Error fetching live event:", error);
        setLiveEvent(null);
        return;
      }

      const event = playerEvents?.[0]?.round_robin_events;
      setLiveEvent(event || null);
    } catch (error) {
      console.error("Error fetching live event:", error);
      setLiveEvent(null);
    }
  };

  const handleBannerClick = () => {
    if (liveEvent) {
      navigate(`/round-robin/${liveEvent.id}`);
    }
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDismissed(true);
  };

  // Don't show if not authenticated, no live event, dismissed, or already on the round robin detail page
  if (!isAuthenticated || !liveEvent || isDismissed || location.pathname.includes(`/round-robin/${liveEvent.id}`)) {
    return null;
  }

  return (
    <div
      onClick={handleBannerClick}
      className="w-full h-12 bg-gradient-to-r from-[#01333f] to-[#01555f] flex items-center justify-center cursor-pointer relative animate-pulse-glow pulse-glow group hover:brightness-110 transition-all"
    >
      <p className="text-white font-bold text-sm md:text-base">
        🟢 Round Robin Match In Progress — Click to View Games
      </p>
      <button
        onClick={handleDismiss}
        className="absolute right-4 p-1 hover:bg-white/10 rounded transition-colors"
        aria-label="Dismiss banner"
      >
        <X className="w-4 h-4 text-white/70 hover:text-white" />
      </button>
    </div>
  );
}
