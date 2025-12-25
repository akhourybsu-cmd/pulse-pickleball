import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Plus, Calendar, Users, MapPin, Repeat, Play, Trophy, Trash2, Eye, Settings, Monitor } from "lucide-react";
import { format, parseISO, isPast } from "date-fns";
import { useVenueRoundRobins, VenueRoundRobinEvent } from "@/hooks/useVenueRoundRobins";
import { useMode } from "@/contexts/ModeContext";
import { Skeleton } from "@/components/ui/skeleton";

export default function VenueRoundRobins() {
  const navigate = useNavigate();
  const { events, isLoading, deleteEvent } = useVenueRoundRobins();
  const { currentVenue } = useMode();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<string | null>(null);

  const draftEvents = events.filter(e => e.status === "draft");
  const liveEvents = events.filter(e => e.status === "live");
  const completedEvents = events.filter(e => e.status === "completed");

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary">Draft</Badge>;
      case "live":
        return <Badge className="bg-green-500 text-white animate-pulse">Live</Badge>;
      case "completed":
        return <Badge variant="outline">Completed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const handleDelete = (eventId: string) => {
    setEventToDelete(eventId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (eventToDelete) {
      deleteEvent.mutate(eventToDelete);
    }
    setDeleteDialogOpen(false);
    setEventToDelete(null);
  };

  const EventCard = ({ event }: { event: VenueRoundRobinEvent }) => (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">{event.name}</CardTitle>
            <CardDescription className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5" />
              {format(parseISO(event.date), "MMM d, yyyy")}
            </CardDescription>
          </div>
          {getStatusBadge(event.status)}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            <span>{event.player_count || 0} players</span>
          </div>
          <div className="flex items-center gap-1">
            <MapPin className="h-4 w-4" />
            <span>{event.num_courts} courts</span>
          </div>
          {event.current_round && (
            <div className="flex items-center gap-1">
              <Repeat className="h-4 w-4" />
              <span>Round {event.current_round}/{event.num_rounds}</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => navigate(`/venue/round-robins/${event.id}`)}
          >
            <Settings className="h-4 w-4 mr-1" />
            Manage
          </Button>
          
          {event.status === "live" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate(`/venue/round-robins/${event.id}/kiosk`)}
            >
              <Monitor className="h-4 w-4 mr-1" />
              Kiosk
            </Button>
          )}
          
          {event.status === "draft" && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => handleDelete(event.id)}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Round Robins</h1>
          <p className="text-muted-foreground">
            Manage round robin tournaments at {currentVenue?.venue_name}
          </p>
        </div>
        <Button onClick={() => navigate("/venue/round-robins/create")}>
          <Plus className="h-4 w-4 mr-2" />
          Create Round Robin
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">
            All ({events.length})
          </TabsTrigger>
          <TabsTrigger value="live" className="gap-2">
            <Play className="h-3.5 w-3.5" />
            Live ({liveEvents.length})
          </TabsTrigger>
          <TabsTrigger value="draft">
            Draft ({draftEvents.length})
          </TabsTrigger>
          <TabsTrigger value="completed" className="gap-2">
            <Trophy className="h-3.5 w-3.5" />
            Completed ({completedEvents.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {events.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Repeat className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Round Robins Yet</h3>
                <p className="text-muted-foreground mb-4">
                  Create your first round robin tournament for {currentVenue?.venue_name}
                </p>
                <Button onClick={() => navigate("/venue/round-robins/create")}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Round Robin
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {events.map(event => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="live" className="space-y-4">
          {liveEvents.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Play className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Live Events</h3>
                <p className="text-muted-foreground">
                  Start a draft event to see it here
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {liveEvents.map(event => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="draft" className="space-y-4">
          {draftEvents.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Draft Events</h3>
                <p className="text-muted-foreground mb-4">
                  Create a new round robin to get started
                </p>
                <Button onClick={() => navigate("/venue/round-robins/create")}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Round Robin
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {draftEvents.map(event => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          {completedEvents.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Completed Events</h3>
                <p className="text-muted-foreground">
                  Completed round robins will appear here
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {completedEvents.map(event => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Round Robin?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the round robin and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
