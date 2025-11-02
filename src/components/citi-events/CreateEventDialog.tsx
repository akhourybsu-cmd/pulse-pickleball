import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CreateEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courtId: string;
  eventId?: string | null;
  onSuccess: () => void;
}

export function CreateEventDialog({
  open,
  onOpenChange,
  courtId,
  eventId,
  onSuccess,
}: CreateEventDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    start_time: "",
    end_time: "",
    max_players: "12",
    waitlist_enabled: true,
    waitlist_max: "",
    skill_tag: "",
    price_label: "",
    is_published: false,
  });

  const handleSubmit = async () => {
    if (!formData.title || !formData.start_time || !formData.end_time) {
      toast.error("Please fill in all required fields");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const eventData = {
        court_id: courtId,
        title: formData.title,
        description: formData.description || null,
        start_time: new Date(formData.start_time).toISOString(),
        end_time: new Date(formData.end_time).toISOString(),
        max_players: parseInt(formData.max_players),
        waitlist_enabled: formData.waitlist_enabled,
        waitlist_max: formData.waitlist_max
          ? parseInt(formData.waitlist_max)
          : null,
        skill_tag: formData.skill_tag || null,
        price_label: formData.price_label || null,
        is_published: formData.is_published,
        created_by: user.id,
      };

      if (eventId) {
        const { error } = await supabase
          .from("citi_events")
          .update(eventData)
          .eq("id", eventId);
        if (error) throw error;
        toast.success("Event updated successfully");
      } else {
        const { error } = await supabase.from("citi_events").insert(eventData);
        if (error) throw error;
        toast.success("Event created successfully");
      }

      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      console.error("Error saving event:", error);
      toast.error(error.message || "Failed to save event");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!eventId) return;
    if (!confirm("Are you sure you want to delete this event?")) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("citi_events")
        .delete()
        .eq("id", eventId);

      if (error) throw error;
      toast.success("Event deleted");
      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      console.error("Error deleting event:", error);
      toast.error("Failed to delete event");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      start_time: "",
      end_time: "",
      max_players: "12",
      waitlist_enabled: true,
      waitlist_max: "",
      skill_tag: "",
      price_label: "",
      is_published: false,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {eventId ? "Edit Event" : "Create New Event"}
          </DialogTitle>
          <DialogDescription>
            Create an exclusive event for Pickleball Citi
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Event Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              placeholder="Thursday Night Doubles"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Join us for an evening of competitive doubles..."
              rows={3}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="start_time">Start Date & Time *</Label>
              <Input
                id="start_time"
                type="datetime-local"
                value={formData.start_time}
                onChange={(e) =>
                  setFormData({ ...formData, start_time: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="end_time">End Date & Time *</Label>
              <Input
                id="end_time"
                type="datetime-local"
                value={formData.end_time}
                onChange={(e) =>
                  setFormData({ ...formData, end_time: e.target.value })
                }
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="max_players">Max Players *</Label>
              <Input
                id="max_players"
                type="number"
                min="4"
                value={formData.max_players}
                onChange={(e) =>
                  setFormData({ ...formData, max_players: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="waitlist_max">Waitlist Max (optional)</Label>
              <Input
                id="waitlist_max"
                type="number"
                min="0"
                value={formData.waitlist_max}
                onChange={(e) =>
                  setFormData({ ...formData, waitlist_max: e.target.value })
                }
                placeholder="No limit"
                disabled={!formData.waitlist_enabled}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="skill_tag">Skill Level</Label>
            <Select
              value={formData.skill_tag}
              onValueChange={(value) =>
                setFormData({ ...formData, skill_tag: value })
              }
            >
              <SelectTrigger id="skill_tag">
                <SelectValue placeholder="Select skill level..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All Levels">All Levels</SelectItem>
                <SelectItem value="Beginner Friendly">
                  Beginner Friendly
                </SelectItem>
                <SelectItem value="3.0+">3.0+</SelectItem>
                <SelectItem value="3.5+">3.5+</SelectItem>
                <SelectItem value="4.0+">4.0+</SelectItem>
                <SelectItem value="Invite Only">Invite Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="price_label">Price</Label>
            <Input
              id="price_label"
              value={formData.price_label}
              onChange={(e) =>
                setFormData({ ...formData, price_label: e.target.value })
              }
              placeholder="Free, $10 Drop-In, etc."
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Waitlist Enabled</Label>
              <p className="text-sm text-muted-foreground">
                Allow players to join a waitlist when full
              </p>
            </div>
            <Switch
              checked={formData.waitlist_enabled}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, waitlist_enabled: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Publish Event</Label>
              <p className="text-sm text-muted-foreground">
                Make event visible to all users
              </p>
            </div>
            <Switch
              checked={formData.is_published}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, is_published: checked })
              }
            />
          </div>
        </div>

        <DialogFooter className="flex justify-between gap-2">
          {eventId && (
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={loading}
            >
              Delete Event
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading
                ? "Saving..."
                : eventId
                ? "Update Event"
                : "Create Event"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
