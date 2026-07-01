import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { isPlatformAdmin } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Eye, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { AdminLayout } from "@/components/admin/AdminLayout";

interface Player {
  id: string;
  full_name: string;
  display_name: string | null;
  email: string;
  current_rating: number;
  total_matches: number;
  wins: number;
  losses: number;
}

export default function AdminPlayers() {
  const navigate = useNavigate();
  const [players, setPlayers] = useState<Player[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please log in to access this page");
        navigate("/auth");
        return;
      }
      if (!(await isPlatformAdmin(user.id))) {
        toast.error("Admin privileges required");
        navigate("/player/dashboard");
        return;
      }
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, full_name, display_name, email, current_rating, total_matches, wins, losses")
          .order("current_rating", { ascending: false });
        if (error) throw error;
        setPlayers(data || []);
      } catch (error) {
        console.error("Error fetching players:", error);
        toast.error("Failed to load players");
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [navigate]);

  const filteredPlayers = useMemo(() => {
    if (!searchQuery.trim()) return players;
    const q = searchQuery.toLowerCase();
    return players.filter(
      (p) =>
        p.full_name?.toLowerCase().includes(q) ||
        p.display_name?.toLowerCase().includes(q) ||
        p.email?.toLowerCase().includes(q),
    );
  }, [searchQuery, players]);

  return (
    <AdminLayout title="Player Directory">
      <div className="container mx-auto p-4 space-y-4 max-w-3xl">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search by name or email…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-11"
          />
        </div>

        <div className="text-xs text-muted-foreground">
          {loading ? "Loading…" : `${filteredPlayers.length} of ${players.length} players`}
        </div>

        <ul className="space-y-2">
          {filteredPlayers.map((player) => {
            const winRate =
              player.total_matches > 0
                ? Math.round((player.wins / player.total_matches) * 100)
                : 0;
            const rating = player.current_rating ?? 3.0;
            const name = player.display_name || player.full_name;

            return (
              <li
                key={player.id}
                className="rounded-xl border border-border/70 bg-card p-3 sm:p-4"
              >
                <div className="flex items-start gap-3">
                  {/* Rating pill on the left — sortable-scan-friendly */}
                  <div className="shrink-0 rounded-lg bg-primary/10 px-2.5 py-1.5 text-center min-w-[3.5rem]">
                    <div className="text-base font-bold text-primary leading-none">
                      {rating.toFixed(2)}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
                      Rating
                    </div>
                  </div>

                  {/* Middle: name, email, stat chips */}
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold truncate">{name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {player.email}
                    </div>
                    <div className="flex items-center gap-2 mt-2 flex-wrap text-xs">
                      <span className="rounded-full bg-muted px-2 py-0.5">
                        {player.total_matches ?? 0} matches
                      </span>
                      <span className="rounded-full bg-muted px-2 py-0.5">
                        {player.wins ?? 0}–{player.losses ?? 0}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
                        <TrendingUp className="w-3 h-3" />
                        {winRate}%
                      </span>
                    </div>
                  </div>

                  {/* Right: view action, always tappable */}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => navigate(`/player/profile?id=${player.id}`)}
                    className="shrink-0 -mr-1"
                    aria-label={`View ${name}`}
                  >
                    <Eye className="w-4 h-4" />
                    <span className="hidden sm:inline ml-1.5">View</span>
                  </Button>
                </div>
              </li>
            );
          })}

          {!loading && filteredPlayers.length === 0 && (
            <li className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No players match that search.
            </li>
          )}
        </ul>
      </div>
    </AdminLayout>
  );
}
