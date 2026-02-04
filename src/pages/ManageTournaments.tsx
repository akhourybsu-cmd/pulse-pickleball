import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trophy, Search } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { TournamentManageCard } from "@/components/tournament/TournamentManageCard";

interface ManagedTournament {
  id: string;
  name: string;
  location: string | null;
  start_date: string;
  end_date: string;
  status: string;
  divisions_count: number;
  public_view_enabled: boolean;
  slug: string | null;
}

type StatusFilter = 'all' | 'draft' | 'active' | 'completed';

export default function ManageTournaments() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [tournaments, setTournaments] = useState<ManagedTournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  useEffect(() => {
    const fetchUserAndTournaments = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth?redirect=/tournaments/manage");
        return;
      }
      setUserId(user.id);

      // Fetch tournaments owned by this user
      const { data, error } = await supabase
        .from("tournaments_events")
        .select(`
          id,
          name,
          location,
          start_date,
          end_date,
          status,
          divisions_count,
          public_view_enabled,
          slug
        `)
        .eq("created_by", user.id)
        .order("start_date", { ascending: false });

      if (error) {
        console.error("Error fetching tournaments:", error);
      } else {
        setTournaments(data || []);
      }
      setLoading(false);
    };

    fetchUserAndTournaments();
  }, [navigate]);

  const filteredTournaments = tournaments.filter((t) => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'draft') return t.status === 'draft';
    if (statusFilter === 'active') return ['upcoming', 'live'].includes(t.status);
    if (statusFilter === 'completed') return ['completed', 'cancelled'].includes(t.status);
    return true;
  });

  const statusFilters: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'draft', label: 'Draft' },
    { value: 'active', label: 'Active' },
    { value: 'completed', label: 'Completed' },
  ];

  return (
    <div className="min-h-screen bg-[hsl(var(--page-bg))]">
      <PageHeader userId={userId} />
      
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold">Manage Tournaments</h1>
            <p className="text-muted-foreground">View and manage your tournament events</p>
          </div>
          <Button onClick={() => navigate("/tournaments/new")}>
            <Plus className="h-4 w-4 mr-2" />
            Create Tournament
          </Button>
        </div>

        {/* Status Filter Pills */}
        <div className="flex flex-wrap gap-2 mb-6">
          {statusFilters.map((filter) => (
            <Button
              key={filter.value}
              size="sm"
              variant={statusFilter === filter.value ? "default" : "outline"}
              onClick={() => setStatusFilter(filter.value)}
            >
              {filter.label}
            </Button>
          ))}
        </div>
        
        {/* Loading state */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="rounded-lg border p-6 space-y-4">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
        ) : filteredTournaments.length === 0 ? (
          <div className="text-center py-16">
            <Trophy className="h-16 w-16 text-muted-foreground/40 mx-auto mb-4" />
            {tournaments.length === 0 ? (
              <>
                <h2 className="text-xl font-semibold mb-2">No tournaments yet</h2>
                <p className="text-muted-foreground mb-6">
                  Create your first tournament to get started
                </p>
                <Button onClick={() => navigate("/tournaments/new")}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Tournament
                </Button>
              </>
            ) : (
              <>
                <h2 className="text-xl font-semibold mb-2">No matching tournaments</h2>
                <p className="text-muted-foreground mb-4">
                  Try changing your filter selection
                </p>
                <Button variant="outline" onClick={() => setStatusFilter('all')}>
                  Show All
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTournaments.map((tournament) => (
              <TournamentManageCard key={tournament.id} tournament={tournament} />
            ))}
          </div>
        )}

        {/* Browse tournaments link */}
        <div className="mt-12 text-center border-t pt-8">
          <p className="text-muted-foreground mb-4">Looking for tournaments to join?</p>
          <Button variant="outline" onClick={() => navigate("/tournaments/browse")}>
            <Search className="h-4 w-4 mr-2" />
            Browse Tournaments
          </Button>
        </div>
      </div>
    </div>
  );
}
