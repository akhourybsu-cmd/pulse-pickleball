import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

interface ActivateSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courtId: string;
  courtName: string;
  onSuccess: (sessionId: string) => void;
}

export function ActivateSessionDialog({
  open,
  onOpenChange,
  courtId,
  courtName,
  onSuccess,
}: ActivateSessionDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: `${courtName} - ${new Date().toLocaleDateString()}`,
    numCourts: 4,
    startTime: new Date().toTimeString().slice(0, 5),
  });

  const handleActivate = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Create session
      const { data: session, error: sessionError } = await supabase
        .from("sessions")
        .insert({
          court_id: courtId,
          name: formData.name,
          session_date: new Date().toISOString().split('T')[0],
          start_time: formData.startTime,
          num_courts: formData.numCourts,
          status: "active",
          created_by: user.id,
          match_type: "ladder",
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      // Generate QR join URL
      const joinUrl = `${window.location.origin}/session-queue?session=${session.id}`;
      
      await supabase
        .from("sessions")
        .update({ qr_join_url: joinUrl })
        .eq("id", session.id);

      toast({
        title: "Session Queue Activated!",
        description: "Players can now join the queue",
      });

      onSuccess(session.id);
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error activating session:", error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Activate Session Queue</DialogTitle>
          <DialogDescription>
            Start a new session queue for {courtName}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="name">Session Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Session name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="courts">Number of Courts</Label>
            <Input
              id="courts"
              type="number"
              min={1}
              max={20}
              value={formData.numCourts}
              onChange={(e) => setFormData({ ...formData, numCourts: parseInt(e.target.value) })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="time">Start Time</Label>
            <Input
              id="time"
              type="time"
              value={formData.startTime}
              onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
            />
          </div>
          <Button 
            onClick={handleActivate} 
            className="w-full"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Activating...
              </>
            ) : (
              'Activate Session Queue'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
