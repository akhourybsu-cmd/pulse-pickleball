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
        <h3 className="text-xs font-medium text-muted-foreground px-1">Your Spaces</h3>
        <div className="bg-muted/20 rounded-xl p-3">
          <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse h-10 w-36 bg-background/80 rounded-lg flex-shrink-0" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (spaces.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-medium text-muted-foreground px-1">Your Spaces</h3>
      {/* Single container with horizontal scroll - larger chips */}
      <div className="bg-muted/20 rounded-xl p-3">
        <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide scroll-smooth">
          {spaces.map((space) => (
            <button
              key={space.id}
              onClick={() => navigate(`/court/board/${space.id}`)}
              className={`
                flex items-center gap-2.5 px-4 py-2.5 rounded-lg min-w-[140px]
                transition-all flex-shrink-0 group
                ${space.isHomeCourt 
                  ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                  : "bg-background text-foreground hover:bg-muted/50 border border-border/50"
                }
              `}
            >
              {space.isHomeCourt ? (
                <Home className="w-4 h-4" />
              ) : (
                <MapPin className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              )}
              <span className="text-sm font-medium truncate flex-1 text-left">
                {space.name}
              </span>
              <ChevronRight className={`w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity ${space.isHomeCourt ? '' : 'text-muted-foreground'}`} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
