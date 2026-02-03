import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PlayerScoreEntry } from "@/components/tournament/scoring/PlayerScoreEntry";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ArrowLeft, Loader2 } from "lucide-react";
import logo from "@/assets/pulse-logo-new.png";

interface EventInfo {
  id: string;
  name: string;
}

interface EventSettings {
  allow_player_score_entry: boolean;
  score_auto_confirm_minutes: number;
}

export default function TournamentMatchScore() {
  const { eventId, matchId } = useParams<{ eventId: string; matchId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [event, setEvent] = useState<EventInfo | null>(null);
  const [settings, setSettings] = useState<EventSettings | null>(null);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    checkAuthAndFetch();
  }, [eventId, matchId]);

  const checkAuthAndFetch = async () => {
    try {
      // Check authentication
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please log in to submit match scores",
        });
        navigate(`/auth?redirect=/tournament/${eventId}/match/${matchId}/score`);
        return;
      }

      setCurrentUserId(user.id);

      // Fetch event info
      const { data: eventData, error: eventError } = await supabase
        .from("tournaments_events")
        .select("id, name")
        .eq("id", eventId)
        .single();

      if (eventError || !eventData) {
        throw new Error("Tournament not found");
      }

      setEvent(eventData);

      // Fetch event settings
      const { data: settingsData } = await supabase
        .from("tournament_event_settings")
        .select("allow_player_score_entry, score_auto_confirm_minutes")
        .eq("event_id", eventId)
        .single();

      const eventSettings: EventSettings = {
        allow_player_score_entry: settingsData?.allow_player_score_entry ?? true,
        score_auto_confirm_minutes: settingsData?.score_auto_confirm_minutes ?? 3,
      };

      setSettings(eventSettings);

      // Check if player score entry is enabled
      if (!eventSettings.allow_player_score_entry) {
        toast({
          title: "Score entry disabled",
          description: "Player score entry is not enabled for this tournament",
          variant: "destructive",
        });
        navigate(`/tournament/${eventId}`);
        return;
      }

      // Verify user is a participant in this match
      const { data: matchData } = await supabase
        .from("tournaments_matches")
        .select("team1_id, team2_id")
        .eq("id", matchId)
        .single();

      if (!matchData) {
        throw new Error("Match not found");
      }

      // Check if user is on one of the teams
      const { data: teams } = await supabase
        .from("tournaments_teams")
        .select("id, player1_id, player2_id")
        .in("id", [matchData.team1_id, matchData.team2_id]);

      const isParticipant = teams?.some(
        (team) => team.player1_id === user.id || team.player2_id === user.id
      );

      if (!isParticipant) {
        toast({
          title: "Not authorized",
          description: "You are not a participant in this match",
          variant: "destructive",
        });
        navigate(`/tournament/${eventId}`);
        return;
      }

      setAuthorized(true);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      navigate("/tournaments");
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = () => {
    toast({
      title: "Score recorded",
      description: "Thank you for submitting the match score",
    });
    navigate(`/tournament/${eventId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!authorized || !currentUserId || !settings) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="bg-secondary border-b border-secondary-foreground/10 shadow-sm">
        <div className="w-full max-w-[1280px] mx-auto px-4 lg:px-6 py-5 flex items-center justify-between h-[72px]">
          <Link to={`/tournament/${eventId}`}>
            <img
              src={logo}
              alt="PULSE Logo"
              className="h-[60px] sm:h-[75px] w-auto cursor-pointer hover:opacity-80 transition-opacity"
            />
          </Link>
          <ThemeToggle />
        </div>
      </nav>

      <div className="max-w-lg mx-auto px-4 py-8">
        <Button
          variant="ghost"
          size="sm"
          className="mb-4"
          onClick={() => navigate(`/tournament/${eventId}`)}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Tournament
        </Button>

        <h1 className="text-2xl font-bold mb-2">{event?.name}</h1>
        <p className="text-muted-foreground mb-6">Submit Match Score</p>

        <PlayerScoreEntry
          matchId={matchId!}
          currentUserId={currentUserId}
          autoConfirmMinutes={settings.score_auto_confirm_minutes}
          onComplete={handleComplete}
        />
      </div>
    </div>
  );
}
