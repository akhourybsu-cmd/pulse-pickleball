import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, ChevronLeft, Calendar, MapPin, Trophy, QrCode, Share2, Edit } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Footer } from "@/components/Footer";
import { QRCodeSVG } from "qrcode.react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Event {
  id: string;
  name: string;
  organizer_id: string;
  location: string | null;
  event_date: string | null;
  start_time: string | null;
  end_time: string | null;
  num_courts: number | null;
  rating_type: string;
  rating_eligible: boolean;
  status: string;
  profiles?: {
    full_name: string;
    display_name: string | null;
  };
}

interface EventMatch {
  id: string;
  round_number: string | null;
  event_court_number: number | null;
  team1_score: number;
  team2_score: number;
  match_date: string;
  created_at: string;
}

const EventDetail = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [matches, setMatches] = useState<EventMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const navigate = useNavigate();

  const matchUrl = `${window.location.origin}/events/${eventId}/add-match`;

  useEffect(() => {
    const fetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        navigate("/auth");
        return;
      }

      setUserId(session.user.id);

      if (!eventId) {
        navigate("/events");
        return;
      }

      // Fetch event
      const { data: eventData, error: eventError } = await supabase
        .from("events")
        .select("*")
        .eq("id", eventId)
        .single();
      
      // Fetch organizer profile separately
      let organizerProfile = null;
      if (eventData) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("full_name, display_name")
          .eq("id", eventData.organizer_id)
          .single();
        
        organizerProfile = profileData;
      }

      if (eventError || !eventData) {
        toast.error("Event not found");
        navigate("/events");
        return;
      }

      setEvent({ ...eventData, profiles: organizerProfile });
      setIsOrganizer(eventData.organizer_id === session.user.id);

      // Fetch matches for this event
      const { data: matchesData, error: matchesError } = await supabase
        .from("matches")
        .select("id, round_number, event_court_number, team1_score, team2_score, match_date, created_at")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });

      if (!matchesError && matchesData) {
        setMatches(matchesData);
      }

      setLoading(false);
    };

    fetchData();
  }, [eventId, navigate]);

  const handleShare = async () => {
    const shareData = {
      title: event?.name || "Event",
      text: `Join me at ${event?.name}!`,
      url: window.location.href
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        toast.success("Shared successfully!");
      } else {
        await navigator.clipboard.writeText(window.location.href);
        toast.success("Link copied to clipboard!");
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Error sharing:', error);
      }
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return "TBD";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (time: string | null) => {
    if (!time) return "";
    return new Date(`2000-01-01T${time}`).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading event...</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Event not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b bg-secondary">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate("/events")}>
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back to Events
          </Button>
          <ThemeToggle />
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        {/* Event Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h1 className="text-4xl font-bold mb-2">{event.name}</h1>
              <p className="text-muted-foreground">
                Organized by {event.profiles?.display_name || event.profiles?.full_name}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="icon" onClick={() => setShowQR(true)}>
                <QrCode className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={handleShare}>
                <Share2 className="w-4 h-4" />
              </Button>
              {isOrganizer && (
                <Button variant="outline" size="icon">
                  <Edit className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Event Details */}
          <div className="grid gap-4 md:grid-cols-3 mb-6">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center text-sm">
                  <Calendar className="w-4 h-4 mr-2 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{formatDate(event.event_date)}</p>
                    {event.start_time && (
                      <p className="text-muted-foreground">
                        {formatTime(event.start_time)}
                        {event.end_time && ` - ${formatTime(event.end_time)}`}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {event.location && (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center text-sm">
                    <MapPin className="w-4 h-4 mr-2 text-muted-foreground" />
                    <p className="font-medium">{event.location}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center text-sm">
                  <Trophy className="w-4 h-4 mr-2 text-muted-foreground" />
                  <div>
                    <p className="font-medium capitalize">{event.rating_type}</p>
                    <p className="text-muted-foreground">
                      {event.rating_eligible ? "Rating Eligible" : "Not Rated"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Add Match Button */}
          {isOrganizer && event.status === "active" && (
            <Button size="lg" onClick={() => navigate(`/events/${eventId}/add-match`)}>
              <Plus className="w-5 h-5 mr-2" />
              Add Match
            </Button>
          )}
        </div>

        {/* Matches List */}
        <Card>
          <CardHeader>
            <CardTitle>Matches ({matches.length})</CardTitle>
            <CardDescription>
              All matches recorded for this event
            </CardDescription>
          </CardHeader>
          <CardContent>
            {matches.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No matches recorded yet
              </p>
            ) : (
              <div className="space-y-2">
                {matches.map((match) => (
                  <div
                    key={match.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent cursor-pointer"
                    onClick={() => navigate(`/match/history#${match.id}`)}
                  >
                    <div className="flex items-center gap-4">
                      {match.round_number && (
                        <span className="text-sm font-medium text-muted-foreground">
                          Round {match.round_number}
                        </span>
                      )}
                      {match.event_court_number && (
                        <span className="text-sm text-muted-foreground">
                          Court {match.event_court_number}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-semibold">
                        {match.team1_score} - {match.team2_score}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {formatDate(match.match_date)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* QR Code Dialog */}
      <Dialog open={showQR} onOpenChange={setShowQR}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Match QR Code</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-6">
            <QRCodeSVG value={matchUrl} size={256} level="H" />
            <p className="text-sm text-muted-foreground text-center">
              Scan to add a match to this event
            </p>
            <Button variant="outline" onClick={() => {
              navigator.clipboard.writeText(matchUrl);
              toast.success("Link copied!");
            }}>
              Copy Link
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
};

export default EventDetail;
