import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { isPlatformAdmin } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Users, Trash2, UserX, CheckCircle } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Footer } from "@/components/Footer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface QueueEntry {
  id: string;
  player_id: string;
  joined_at: string;
  games_played: number;
  status: string;
  profiles: {
    display_name: string | null;
    full_name: string;
    current_rating: number;
  };
}

interface MatchTicket {
  id: string;
  court_number: number;
  status: string;
  team1_player1: { display_name: string | null; full_name: string };
  team1_player2: { display_name: string | null; full_name: string };
  team2_player1: { display_name: string | null; full_name: string };
  team2_player2: { display_name: string | null; full_name: string };
}

export default function AdminManage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session");
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [queueEntries, setQueueEntries] = useState<QueueEntry[]>([]);
  const [matchTickets, setMatchTickets] = useState<MatchTicket[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [selectedCourt, setSelectedCourt] = useState<string>("1");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [ticketToDelete, setTicketToDelete] = useState<string | null>(null);

  useEffect(() => {
    checkAdminAccess();
    
    // Auto-refresh every 15 seconds
    const refreshInterval = setInterval(() => {
      if (sessionId) {
        fetchSessionData();
      }
    }, 15000);

    return () => clearInterval(refreshInterval);
  }, [sessionId]);

  const checkAdminAccess = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }

    if (!(await isPlatformAdmin(user.id))) {
      toast({
        title: "Access Denied",
        description: "You don't have admin access",
        variant: "destructive",
      });
      navigate("/dashboard");
      return;
    }

    setIsAdmin(true);
    if (sessionId) {
      await fetchSessionData();
    }
    setLoading(false);
  };

  const fetchSessionData = async () => {
    if (!sessionId) return;

    const { data: sessionData } = await supabase
      .from("sessions")
      .select("*")
      .eq("id", sessionId)
      .single();

    if (sessionData) {
      setSession(sessionData);
    }

    const { data: queueData } = await supabase
      .from("queue_entries")
      .select(`
        *,
        profiles:player_id (display_name, full_name, current_rating)
      `)
      .eq("session_id", sessionId)
      .order("joined_at", { ascending: true });

    if (queueData) {
      setQueueEntries(queueData as any);
    }

    const { data: ticketsData } = await supabase
      .from("match_tickets")
      .select(`
        *,
        team1_player1:team1_player1_id (display_name, full_name),
        team1_player2:team1_player2_id (display_name, full_name),
        team2_player1:team2_player1_id (display_name, full_name),
        team2_player2:team2_player2_id (display_name, full_name)
      `)
      .eq("session_id", sessionId)
      .in("status", ["on-deck", "live"])
      .order("court_number", { ascending: true });

    if (ticketsData) {
      setMatchTickets(ticketsData as any);
    }
  };

  const togglePlayerSelection = (playerId: string) => {
    setSelectedPlayers(prev =>
      prev.includes(playerId)
        ? prev.filter(id => id !== playerId)
        : [...prev, playerId]
    );
  };

  const handleCreateManualMatch = async () => {
    if (selectedPlayers.length !== 4) {
      toast({
        title: "Select 4 Players",
        description: "You need exactly 4 players to create a match",
        variant: "destructive",
      });
      return;
    }

    if (!sessionId) return;

    try {
      const courtNum = parseInt(selectedCourt);

      // Check if court is already in use
      const { data: existingTicket } = await supabase
        .from("match_tickets")
        .select("id")
        .eq("session_id", sessionId)
        .eq("court_number", courtNum)
        .in("status", ["live", "on-deck"])
        .maybeSingle();

      if (existingTicket) {
        toast({
          title: "Court In Use",
          description: `Court ${courtNum} is already assigned to a match`,
          variant: "destructive",
        });
        return;
      }

      // Check if any selected player is already playing
      const { data: playingPlayers } = await supabase
        .from("queue_entries")
        .select("player_id")
        .eq("session_id", sessionId)
        .eq("status", "playing")
        .in("player_id", selectedPlayers);

      if (playingPlayers && playingPlayers.length > 0) {
        toast({
          title: "Player Already Playing",
          description: "One or more selected players are already in a match",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from("match_tickets")
        .insert({
          session_id: sessionId,
          court_number: courtNum,
          team1_player1_id: selectedPlayers[0],
          team1_player2_id: selectedPlayers[1],
          team2_player1_id: selectedPlayers[2],
          team2_player2_id: selectedPlayers[3],
          status: "live",
        });

      if (error) throw error;

      // Update queue entries to 'playing'
      await supabase
        .from("queue_entries")
        .update({ status: "playing" })
        .eq("session_id", sessionId)
        .in("player_id", selectedPlayers);

      toast({
        title: "Match Created!",
        description: `Match assigned to Court ${selectedCourt}`,
      });

      setSelectedPlayers([]);
      await fetchSessionData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleMarkAFK = async (playerId: string) => {
    if (!sessionId) return;

    try {
      await supabase
        .from("queue_entries")
        .update({ status: "afk" })
        .eq("session_id", sessionId)
        .eq("player_id", playerId);

      toast({
        title: "Player Marked AFK",
        description: "Player removed from active queue",
      });

      await fetchSessionData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleReactivatePlayer = async (playerId: string) => {
    if (!sessionId) return;

    try {
      await supabase
        .from("queue_entries")
        .update({ status: "waiting" })
        .eq("session_id", sessionId)
        .eq("player_id", playerId);

      toast({
        title: "Player Reactivated",
        description: "Player added back to queue",
      });

      await fetchSessionData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const confirmDeleteMatch = (ticketId: string) => {
    setTicketToDelete(ticketId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteMatch = async () => {
    if (!ticketToDelete || !sessionId) return;

    try {
      // Get player IDs from the ticket
      const ticket = matchTickets.find(t => t.id === ticketToDelete);
      if (!ticket) return;

      // Delete the ticket
      await supabase
        .from("match_tickets")
        .delete()
        .eq("id", ticketToDelete);

      // Return players to queue - we need to get the player IDs from the ticket
      const { data: ticketData } = await supabase
        .from("match_tickets")
        .select("team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id")
        .eq("id", ticketToDelete)
        .single();

      if (ticketData) {
        const playerIds = [
          ticketData.team1_player1_id,
          ticketData.team1_player2_id,
          ticketData.team2_player1_id,
          ticketData.team2_player2_id,
        ];

        await supabase
          .from("queue_entries")
          .update({ status: "waiting" })
          .eq("session_id", sessionId)
          .in("player_id", playerIds);
      }

      toast({
        title: "Match Cancelled",
        description: "Players returned to queue",
      });

      setDeleteDialogOpen(false);
      setTicketToDelete(null);
      await fetchSessionData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!isAdmin || !session) {
    return null;
  }

  const waitingPlayers = queueEntries.filter(e => e.status === "waiting");
  const afkPlayers = queueEntries.filter(e => e.status === "afk");
  const playingPlayers = queueEntries.filter(e => e.status === "playing");

  return (
    <div className="min-h-screen flex flex-col">
      <div className="border-b bg-secondary/30">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate("/admin/session")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Sessions
          </Button>
          <ThemeToggle />
        </div>
      </div>

      <div className="flex-1 container mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Manage Session</h1>
          <Badge variant="secondary">
            <Users className="mr-2 h-4 w-4" />
            {queueEntries.length} Total Players
          </Badge>
        </div>

        {/* Active Matches */}
        {matchTickets.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Active Matches</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {matchTickets.map((ticket) => (
                <div key={ticket.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold">Court {ticket.court_number}</span>
                      <Badge variant={ticket.status === "live" ? "default" : "secondary"}>
                        {ticket.status}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Team 1</p>
                        <p>{ticket.team1_player1.display_name || ticket.team1_player1.full_name}</p>
                        <p>{ticket.team1_player2.display_name || ticket.team1_player2.full_name}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Team 2</p>
                        <p>{ticket.team2_player1.display_name || ticket.team2_player1.full_name}</p>
                        <p>{ticket.team2_player2.display_name || ticket.team2_player2.full_name}</p>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => confirmDeleteMatch(ticket.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Manual Match Creation */}
        <Card>
          <CardHeader>
            <CardTitle>Create Manual Match</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Select value={selectedCourt} onValueChange={setSelectedCourt}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: session.num_courts }, (_, i) => i + 1).map((num) => (
                    <SelectItem key={num} value={num.toString()}>
                      Court {num}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Badge variant="outline">
                {selectedPlayers.length}/4 players selected
              </Badge>
              <Button
                onClick={handleCreateManualMatch}
                disabled={selectedPlayers.length !== 4}
                className="ml-auto"
              >
                Create Match
              </Button>
            </div>

            {waitingPlayers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No players in queue
              </p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {waitingPlayers.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center gap-3 p-3 border rounded hover:bg-secondary/50 cursor-pointer"
                    onClick={() => togglePlayerSelection(entry.player_id)}
                  >
                    <Checkbox
                      checked={selectedPlayers.includes(entry.player_id)}
                      onCheckedChange={() => togglePlayerSelection(entry.player_id)}
                    />
                    <div className="flex-1">
                      <p className="font-medium">
                        {entry.profiles.display_name || entry.profiles.full_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Rating: {entry.profiles.current_rating.toFixed(2)} • Games: {entry.games_played}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMarkAFK(entry.player_id);
                      }}
                    >
                      <UserX className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* AFK Players */}
        {afkPlayers.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>AFK Players ({afkPlayers.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {afkPlayers.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between p-3 border rounded"
                  >
                    <div>
                      <p className="font-medium">
                        {entry.profiles.display_name || entry.profiles.full_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Rating: {entry.profiles.current_rating.toFixed(2)}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleReactivatePlayer(entry.player_id)}
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Reactivate
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Match?</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel the match and return all players to the queue. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteMatch}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Footer />
    </div>
  );
}
