import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ChevronLeft, Calendar } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

const NewEvent = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  
  // Form fields
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [numCourts, setNumCourts] = useState<number>(3);
  const [pointsTo, setPointsTo] = useState<number>(11);
  const [winBy2, setWinBy2] = useState(true);
  const [ratingType, setRatingType] = useState("ladder");
  const [ratingEligible, setRatingEligible] = useState(true);
  const [visibility, setVisibility] = useState("public");
  const [otherLocation, setOtherLocation] = useState("");
  
  const navigate = useNavigate();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        navigate("/auth");
        return;
      }
      setUserId(session.user.id);
      
      // Set default date to today
      const today = new Date().toISOString().split("T")[0];
      setEventDate(today);
    };

    checkUser();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!userId) {
      toast.error("You must be logged in to create an event");
      return;
    }

    if (!name.trim()) {
      toast.error("Event name is required");
      return;
    }

    setSubmitting(true);

    try {
      const { data: event, error } = await supabase
        .from("events")
        .insert({
          name: name.trim(),
          organizer_id: userId,
          location: location === 'other' ? 'other' : (location.trim() || null),
          other_location: location === 'other' ? otherLocation : null,
          event_date: eventDate || null,
          start_time: startTime || null,
          end_time: endTime || null,
          num_courts: numCourts,
          points_to: pointsTo,
          win_by_2: winBy2,
          rating_type: ratingType,
          rating_eligible: ratingEligible,
          visibility,
          status: "active",
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating event:", error);
        toast.error("Failed to create event");
        return;
      }

      toast.success("Event created successfully!");
      navigate(`/events/${event.id}`);
    } catch (error) {
      console.error("Unexpected error:", error);
      toast.error("Failed to create event");
    } finally {
      setSubmitting(false);
    }
  };

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

      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Create Event</h1>
          <p className="text-muted-foreground">
            Set up a new event for organizing matches
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Event Details
              </CardTitle>
              <CardDescription>
                Basic information about your event
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Event Name */}
              <div className="space-y-2">
                <Label htmlFor="name">Event Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Nickerson Open Play - Aug 10"
                  required
                />
              </div>

              {/* Location */}
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Select value={location} onValueChange={setLocation}>
                  <SelectTrigger id="location">
                    <SelectValue placeholder="Select or enter location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {location === 'other' && (
                <div className="space-y-2">
                  <Label htmlFor="otherLocation">Location Name</Label>
                  <Input
                    id="otherLocation"
                    value={otherLocation}
                    onChange={(e) => setOtherLocation(e.target.value)}
                    placeholder="Enter custom location name"
                    required
                  />
                </div>
              )}

              {/* Date and Time */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="eventDate">Date</Label>
                  <Input
                    id="eventDate"
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="startTime">Start Time</Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endTime">End Time</Label>
                  <Input
                    id="endTime"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
              </div>

              {/* Number of Courts */}
              <div className="space-y-2">
                <Label htmlFor="numCourts">Number of Courts</Label>
                <Input
                  id="numCourts"
                  type="number"
                  min="1"
                  max="20"
                  value={numCourts}
                  onChange={(e) => setNumCourts(parseInt(e.target.value) || 1)}
                />
              </div>

              {/* Rating Settings */}
              <div className="border-t pt-6 space-y-4">
                <h3 className="font-semibold">Rating Settings</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="pointsTo">Points to Win</Label>
                    <Input
                      id="pointsTo"
                      type="number"
                      min="1"
                      value={pointsTo}
                      onChange={(e) => setPointsTo(parseInt(e.target.value) || 11)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="ratingType">Rating Type</Label>
                    <Select value={ratingType} onValueChange={setRatingType}>
                      <SelectTrigger id="ratingType">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ladder">Ladder</SelectItem>
                        <SelectItem value="league">League</SelectItem>
                        <SelectItem value="playoffs">Playoffs</SelectItem>
                        <SelectItem value="casual">Casual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="winBy2">Win by 2</Label>
                    <p className="text-sm text-muted-foreground">
                      Require winning by 2 points
                    </p>
                  </div>
                  <Switch
                    id="winBy2"
                    checked={winBy2}
                    onCheckedChange={setWinBy2}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="ratingEligible">Rating Eligible</Label>
                    <p className="text-sm text-muted-foreground">
                      Count matches toward PULSE ratings
                    </p>
                  </div>
                  <Switch
                    id="ratingEligible"
                    checked={ratingEligible}
                    onCheckedChange={setRatingEligible}
                  />
                </div>
              </div>

              {/* Visibility */}
              <div className="space-y-2">
                <Label htmlFor="visibility">Visibility</Label>
                <Select value={visibility} onValueChange={setVisibility}>
                  <SelectTrigger id="visibility">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="unlisted">Unlisted</SelectItem>
                    <SelectItem value="private">Private</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  {visibility === "public" && "Visible to everyone"}
                  {visibility === "unlisted" && "Only visible via direct link"}
                  {visibility === "private" && "Only visible to you"}
                </p>
              </div>

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Creating..." : "Create Event"}
              </Button>
            </CardContent>
          </Card>
        </form>
      </div>
    </div>
  );
};

export default NewEvent;
