import { Calendar, Trophy, Users, MapPin, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import type { GroupPost } from "@/hooks/useGroupPosts";

interface RoundRobinPostCardProps {
  rr: NonNullable<GroupPost["round_robin"]>;
}

export function RoundRobinPostCard({ rr }: RoundRobinPostCardProps) {
  const navigate = useNavigate();
  const isFull = rr.max_players != null && rr.player_count >= rr.max_players;
  const isClosed = rr.status === "completed" || rr.status === "live";

  const handleJoin = () => {
    if (rr.registration_mode === "invite_only" && rr.invite_code) {
      navigate(`/round-robin/join/${rr.invite_code}`);
    } else {
      navigate(`/round-robin/${rr.id}`);
    }
  };

  return (
    <div className="mt-3 rounded-lg border border-primary/30 bg-gradient-to-br from-primary/5 to-transparent p-3.5">
      <div className="flex items-start gap-2.5">
        <div className="p-2 rounded-lg bg-primary/15 text-primary shrink-0">
          <Trophy className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-primary">
              Round Robin
            </span>
            {isClosed && (
              <span className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">
                · {rr.status}
              </span>
            )}
          </div>
          <h4 className="font-semibold text-sm truncate">{rr.name}</h4>

          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {format(new Date(rr.date), "EEE, MMM d")}
              {rr.start_time ? ` · ${rr.start_time.slice(0, 5)}` : ""}
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {rr.num_courts} {rr.num_courts === 1 ? "court" : "courts"}
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {rr.player_count}
              {rr.max_players ? ` / ${rr.max_players}` : ""} players
            </span>
          </div>
        </div>
      </div>

      <Button
        size="sm"
        className="w-full mt-3 h-8 gap-1"
        onClick={handleJoin}
        disabled={isClosed || isFull}
      >
        {isClosed ? "View Event" : isFull ? "Event Full" : "Join Round Robin"}
        {!isClosed && !isFull && <ChevronRight className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}
