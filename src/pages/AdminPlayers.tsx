import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Search, Eye } from "lucide-react";
import { toast } from "sonner";

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
  const [filteredPlayers, setFilteredPlayers] = useState<Player[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAdminAccess();
    fetchPlayers();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredPlayers(players);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = players.filter(
        (player) =>
          player.full_name.toLowerCase().includes(query) ||
          (player.display_name?.toLowerCase().includes(query)) ||
          player.email.toLowerCase().includes(query)
      );
      setFilteredPlayers(filtered);
    }
  }, [searchQuery, players]);

  const checkAdminAccess = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      toast.error("Please log in to access this page");
      navigate("/auth");
      return;
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      toast.error("Access denied. Admin privileges required.");
      navigate("/player/dashboard");
    }
  };

  const fetchPlayers = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, display_name, email, current_rating, total_matches, wins, losses")
        .order("current_rating", { ascending: false });

      if (error) throw error;

      setPlayers(data || []);
      setFilteredPlayers(data || []);
    } catch (error) {
      console.error("Error fetching players:", error);
      toast.error("Failed to load players");
    } finally {
      setLoading(false);
    }
  };

  const handleViewProfile = (playerId: string) => {
    navigate(`/profile/${playerId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading players...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 space-y-6">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => navigate("/admin")}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Admin
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Player Directory</CardTitle>
            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground mb-4">
              Showing {filteredPlayers.length} of {players.length} players
            </div>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="text-center">Rating</TableHead>
                    <TableHead className="text-center">Matches</TableHead>
                    <TableHead className="text-center">Record</TableHead>
                    <TableHead className="text-center">Win %</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPlayers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        No players found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPlayers.map((player) => {
                      const winRate = player.total_matches > 0 
                        ? ((player.wins / player.total_matches) * 100).toFixed(1)
                        : "0.0";
                      const rating = player.current_rating ?? 3.00;
                      
                      return (
                        <TableRow key={player.id} className="cursor-pointer hover:bg-muted/50">
                          <TableCell className="font-medium">
                            {player.display_name || player.full_name}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {player.email}
                          </TableCell>
                          <TableCell className="text-center font-semibold">
                            {rating.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-center">
                            {player.total_matches ?? 0}
                          </TableCell>
                          <TableCell className="text-center">
                            {player.wins ?? 0}-{player.losses ?? 0}
                          </TableCell>
                          <TableCell className="text-center">
                            {winRate}%
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleViewProfile(player.id)}
                              className="gap-1"
                            >
                              <Eye className="w-4 h-4" />
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
