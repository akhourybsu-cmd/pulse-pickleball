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

      // Fetch home court if set
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

      // Fetch recently played courts (up to 3 more)
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
      <div className="flex gap-2 overflow-x-auto pb-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse h-12 w-32 bg-muted rounded-xl flex-shrink-0" />
        ))}
      </div>
    );
  }

  if (spaces.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-muted-foreground px-1">Your Spaces</h3>
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
        {spaces.map((space) => (
          <button
            key={space.id}
            onClick={() => navigate(`/court/board/${space.id}`)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-card border border-border hover:border-primary/30 hover:shadow-sm transition-all flex-shrink-0"
          >
            {space.isHomeCourt ? (
              <Home className="w-4 h-4 text-primary" />
            ) : (
              <MapPin className="w-4 h-4 text-muted-foreground" />
            )}
            <span className="text-sm font-medium truncate max-w-[120px]">{space.name}</span>
            <ChevronRight className="w-3 h-3 text-muted-foreground" />
          </button>
        ))}
      </div>
    </div>
  );
};
