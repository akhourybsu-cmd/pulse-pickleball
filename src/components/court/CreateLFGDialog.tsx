import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface CreateLFGDialogProps {
  courtId: string;
  userId: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateLFGDialog({ courtId, userId, onClose, onSuccess }: CreateLFGDialogProps) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    date: "",
    startTime: "18:00",
    endTime: "20:00",
    format: "doubles",
    capacity: "4",
    intensity: "casual",
    notes: "",
  });

  const handleSubmit = async () => {
    if (!userId) {
      toast({
        title: "Authentication Required",
        description: "Please log in to create an LFG post",
        variant: "destructive",
      });
      return;
    }

    if (!formData.title || !formData.date || !formData.startTime || !formData.endTime) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    const startsAt = new Date(`${formData.date}T${formData.startTime}`).toISOString();
    const endsAt = new Date(`${formData.date}T${formData.endTime}`).toISOString();

    // Create the LFG post
    const { data: lfgPost, error: postError } = await (supabase as any)
      .from("lfg_posts")
      .insert({
        court_id: courtId,
        created_by: userId,
        title: formData.title,
        starts_at: startsAt,
        ends_at: endsAt,
        format: formData.format,
        capacity: parseInt(formData.capacity),
        intensity: formData.intensity,
        notes: formData.notes,
        status: "open",
      })
      .select()
      .single();

    if (postError || !lfgPost) {
      setSubmitting(false);
      toast({
        title: "Error",
        description: "Failed to create LFG post",
        variant: "destructive",
      });
      return;
    }

    // Auto-RSVP the creator
    await (supabase as any)
      .from("lfg_rsvps")
      .insert({
        lfg_id: lfgPost.id,
        user_id: userId,
        status: "yes",
      });

    setSubmitting(false);
    onSuccess();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create LFG Post</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              type="text"
              placeholder="e.g., Morning Drills, Competitive Doubles"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="capacity">Players</Label>
              <Input
                id="capacity"
                type="number"
                min="2"
                max="20"
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="startTime">Start Time</Label>
              <Input
                id="startTime"
                type="time"
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="endTime">End Time</Label>
              <Input
                id="endTime"
                type="time"
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="format">Format</Label>
            <Select value={formData.format} onValueChange={(v) => setFormData({ ...formData, format: v })}>
              <SelectTrigger id="format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="doubles">Doubles</SelectItem>
                <SelectItem value="singles">Singles</SelectItem>
                <SelectItem value="mixed">Mixed Doubles</SelectItem>
                <SelectItem value="ladder">Ladder</SelectItem>
                <SelectItem value="drills">Drills</SelectItem>
                <SelectItem value="open">Open Play</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="intensity">Intensity</Label>
            <Select value={formData.intensity} onValueChange={(v) => setFormData({ ...formData, intensity: v })}>
              <SelectTrigger id="intensity">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="casual">Casual</SelectItem>
                <SelectItem value="competitive">Competitive</SelectItem>
                <SelectItem value="drills">Drills/Practice</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Any additional details..."
              rows={3}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Creating..." : "Create LFG"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
