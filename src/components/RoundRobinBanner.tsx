import { useEffect, useState, memo } from "react";
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

export const RoundRobinBanner = memo(function RoundRobinBanner() {
  const [liveEvent, setLiveEvent] = useState<LiveEvent | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let mounted = true;

    const fetchLiveEvent = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !mounted) return;

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

        if (error) throw error;

        const event = playerEvents?.[0]?.round_robin_events;
        if (mounted) setLiveEvent(event || null);
      } catch (error) {
        console.error("Error fetching live event:", error);
      }
    };

    fetchLiveEvent();

    return () => {
      mounted = false;
    };
  }, []);

  const handleBannerClick = () => {
    if (liveEvent) {
      navigate(`/round-robin/${liveEvent.id}`);
    }
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDismissed(true);
  };

  if (!liveEvent || isDismissed || location.pathname.includes(`/round-robin/${liveEvent.id}`)) {
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
});
