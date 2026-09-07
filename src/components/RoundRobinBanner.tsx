import { useEffect, useState, memo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { X } from "lucide-react";
import { useAuthState } from "@/hooks/useAuthState";
import { fetchUserRoundRobinEvents } from "@/lib/roundRobin/userEvents";

interface LiveEvent {
  id: string;
  name: string;
  date: string;
  current_round: number;
  num_rounds: number;
}

export const RoundRobinBanner = memo(() => {
  const [liveEvent, setLiveEvent] = useState<LiveEvent | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthState();
  const userId = user?.id;

  useEffect(() => {
    let cancelled = false;

    const fetchLiveEvent = async () => {
      if (!userId) {
        setLiveEvent(null);
        return;
      }

      try {
        const entries = await fetchUserRoundRobinEvents(userId);
        if (cancelled) return;

        const event = entries.find(({ event: candidate }) =>
          !candidate.voided && candidate.status === "live",
        )?.event;
        setLiveEvent(event ? {
          id: event.id,
          name: event.name,
          date: event.date,
          current_round: event.current_round ?? 1,
          num_rounds: event.num_rounds,
        } : null);
      } catch (error) {
        console.error("Error fetching live event:", error);
        if (!cancelled) setLiveEvent(null);
      }
    };

    fetchLiveEvent();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const handleBannerClick = () => {
    if (liveEvent) {
      navigate(`/round-robin/${liveEvent.id}`);
    }
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDismissed(true);
  };

  // Don't show if no live event, dismissed, or already on the round robin detail page
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

RoundRobinBanner.displayName = 'RoundRobinBanner';
