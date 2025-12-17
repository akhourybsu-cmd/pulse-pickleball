import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, Home, ChevronRight } from "lucide-react";

interface Space {
  id: string;
  name: string;
  isHomeCourt: boolean;
}

interface SpacesPreviewRowProps {
  userId: string | undefined;
  homeCourtId: string | null;
}

export const SpacesPreviewRow = ({ userId, homeCourtId }: SpacesPreviewRowProps) => {
  const navigate = useNavigate();
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSpaces = async () => {
      setLoading(true);
      const spacesList: Space[] = [];

      if (homeCourtId) {
        const { data: homeCourt } = await supabase
          .from("courts")
          .select("id, name")
          .eq("id", homeCourtId)
          .single();

        if (homeCourt) {
          spacesList.push({
            id: homeCourt.id,
            name: homeCourt.name,
            isHomeCourt: true,
          });
        }
      }

      if (userId) {
        const { data: recentMatches } = await supabase
          .from("match_participants")
          .select(`
            match:matches (
              court:courts (id, name)
            )
          `)
          .eq("player_id", userId)
          .order("created_at", { ascending: false })
          .limit(20);

        if (recentMatches) {
          const seenCourts = new Set(spacesList.map(s => s.id));
          
          for (const m of recentMatches) {
            if (spacesList.length >= 4) break;
            const court = (m.match as any)?.court;
            if (court && !seenCourts.has(court.id)) {
              seenCourts.add(court.id);
              spacesList.push({
                id: court.id,
                name: court.name,
                isHomeCourt: false,
              });
            }
          }
        }
      }

      setSpaces(spacesList);
      setLoading(false);
    };

    fetchSpaces();
  }, [userId, homeCourtId]);

  if (loading) {
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground px-1">Your Spaces</h3>
        <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse h-16 w-28 bg-muted rounded-xl flex-shrink-0 snap-start" />
          ))}
        </div>
      </div>
    );
  }

  if (spaces.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-muted-foreground px-1">Your Spaces</h3>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory scrollbar-hide">
        {spaces.map((space) => (
          <button
            key={space.id}
            onClick={() => navigate(`/court/board/${space.id}`)}
            className="flex flex-col items-start gap-1 p-3 rounded-xl bg-card border border-border hover:border-primary/30 hover:shadow-sm transition-all flex-shrink-0 snap-start min-w-[112px] w-28"
          >
            <div className="flex items-center justify-between w-full">
              {space.isHomeCourt ? (
                <Home className="w-5 h-5 text-primary" />
              ) : (
                <MapPin className="w-5 h-5 text-muted-foreground" />
              )}
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
            <span className="text-xs font-medium text-foreground truncate w-full text-left">
              {space.name}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
