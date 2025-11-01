import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface Court {
  id: string;
  event_id: string;
  court_number: number;
  court_name: string | null;
  available: boolean;
  created_at: string;
}

interface CourtManagementPanelProps {
  eventId: string;
}

export function CourtManagementPanel({ eventId }: CourtManagementPanelProps) {
  const { toast } = useToast();
  const [courts, setCourts] = useState<Court[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newCourtNumber, setNewCourtNumber] = useState<number>(1);
  const [newCourtName, setNewCourtName] = useState<string>("");

  useEffect(() => {
    fetchCourts();
  }, [eventId]);

  const fetchCourts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tournaments_courts")
      .select("*")
      .eq("event_id", eventId)
      .order("court_number");

    if (error) {
      toast({
        title: "Error loading courts",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setCourts(data || []);
      // Set next court number
      const maxNumber = data?.reduce((max, c) => Math.max(max, c.court_number), 0) || 0;
      setNewCourtNumber(maxNumber + 1);
    }
    setLoading(false);
  };

  const handleAddCourt = async () => {
    if (newCourtNumber < 1) {
      toast({
        title: "Invalid court number",
        description: "Court number must be at least 1",
        variant: "destructive",
      });
      return;
    }

    setAdding(true);
    const { error } = await supabase.from("tournaments_courts").insert({
      event_id: eventId,
      court_number: newCourtNumber,
      court_name: newCourtName || null,
      available: true,
    });

    if (error) {
      toast({
        title: "Error adding court",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Court added",
        description: `Court ${newCourtNumber} has been added`,
      });
      setNewCourtName("");
      fetchCourts();
    }
    setAdding(false);
  };

  const handleToggleAvailability = async (courtId: string, currentAvailable: boolean) => {
    const { error } = await supabase
      .from("tournaments_courts")
      .update({ available: !currentAvailable })
      .eq("id", courtId);

    if (error) {
      toast({
        title: "Error updating court",
        description: error.message,
        variant: "destructive",
      });
    } else {
      fetchCourts();
    }
  };

  const handleDeleteCourt = async (courtId: string, courtNumber: number) => {
    const { error } = await supabase
      .from("tournaments_courts")
      .delete()
      .eq("id", courtId);

    if (error) {
      toast({
        title: "Error deleting court",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Court deleted",
        description: `Court ${courtNumber} has been removed`,
      });
      fetchCourts();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Add Court</CardTitle>
          <CardDescription>Add a new court to this event</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="court-number">Court Number</Label>
              <Input
                id="court-number"
                type="number"
                min={1}
                value={newCourtNumber}
                onChange={(e) => setNewCourtNumber(parseInt(e.target.value) || 1)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="court-name">Court Name (Optional)</Label>
              <Input
                id="court-name"
                placeholder="e.g., Center Court, Court A"
                value={newCourtName}
                onChange={(e) => setNewCourtName(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleAddCourt} disabled={adding} className="w-full">
                {adding ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                Add Court
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Existing Courts ({courts.length})</CardTitle>
          <CardDescription>Manage courts for this event</CardDescription>
        </CardHeader>
        <CardContent>
          {courts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No courts added yet. Add courts to start scheduling matches.
            </p>
          ) : (
            <div className="space-y-2">
              {courts.map((court) => (
                <div
                  key={court.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="font-medium">
                        Court {court.court_number}
                        {court.court_name && (
                          <span className="text-muted-foreground ml-2">
                            ({court.court_name})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`available-${court.id}`}>Available</Label>
                      <Switch
                        id={`available-${court.id}`}
                        checked={court.available}
                        onCheckedChange={() =>
                          handleToggleAvailability(court.id, court.available)
                        }
                      />
                    </div>
                    <Badge variant={court.available ? "default" : "secondary"}>
                      {court.available ? "Active" : "Blocked"}
                    </Badge>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Court?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete Court {court.court_number}
                            {court.court_name && ` (${court.court_name})`}. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteCourt(court.id, court.court_number)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete Court
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
