import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { MapPin, LogOut } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface CourtCheckInProps {
  courtId: string;
  userId: string | null;
}

export function CourtCheckIn({ courtId, userId }: CourtCheckInProps) {
  const { toast } = useToast();
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [checkInId, setCheckInId] = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [duration, setDuration] = useState("2");

  useEffect(() => {
    if (userId) {
      checkCurrentCheckIn();
    }
  }, [userId, courtId]);

  const checkCurrentCheckIn = async () => {
    const { data } = await (supabase as any)
      .from("court_checkins")
      .select("id, ends_at")
      .eq("court_id", courtId)
      .eq("user_id", userId)
      .gt("ends_at", new Date().toISOString())
      .single();

    if (data) {
      setIsCheckedIn(true);
      setCheckInId(data.id);
    } else {
      setIsCheckedIn(false);
      setCheckInId(null);
    }
  };

  const handleCheckIn = async () => {
    if (!userId) return;

    const hours = parseFloat(duration);
    const endsAt = new Date();
    endsAt.setHours(endsAt.getHours() + hours);

    const { error } = await (supabase as any)
      .from("court_checkins")
      .insert({
        court_id: courtId,
        user_id: userId,
        ends_at: endsAt.toISOString(),
      });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to check in",
        variant: "destructive",
      });
    } else {
      setIsCheckedIn(true);
      setShowDialog(false);
      toast({
        title: "Checked In",
        description: `You're at the courts for ${hours} hour${hours !== 1 ? 's' : ''}`,
      });
      checkCurrentCheckIn();
    }
  };

  const handleCheckOut = async () => {
    if (!checkInId) return;

    const { error } = await (supabase as any)
      .from("court_checkins")
      .update({ ends_at: new Date().toISOString() })
      .eq("id", checkInId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to check out",
        variant: "destructive",
      });
    } else {
      setIsCheckedIn(false);
      setCheckInId(null);
      toast({
        title: "Checked Out",
        description: "See you next time!",
      });
    }
  };

  if (!userId) return null;

  return (
    <>
      {isCheckedIn ? (
        <Button onClick={handleCheckOut} variant="outline" size="sm" className="gap-2">
          <LogOut className="w-4 h-4" />
          Check Out
        </Button>
      ) : (
        <Button onClick={() => setShowDialog(true)} size="sm" className="gap-2">
          <MapPin className="w-4 h-4" />
          Check In
        </Button>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Check In at Court</DialogTitle>
            <DialogDescription>
              Let others know you're here and how long you'll be playing.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>How long will you be here?</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 hour</SelectItem>
                  <SelectItem value="1.5">1.5 hours</SelectItem>
                  <SelectItem value="2">2 hours</SelectItem>
                  <SelectItem value="3">3 hours</SelectItem>
                  <SelectItem value="4">4 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCheckIn}>
              Check In
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
