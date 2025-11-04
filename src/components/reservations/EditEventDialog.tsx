import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";

interface EditEventDialogProps {
  isOpen: boolean;
  onClose: () => void;
  event: {
    id: string;
    title: string;
    description?: string;
    event_type: "league" | "open_play" | "private" | "lesson";
    start_time: string;
    end_time: string;
    capacity?: number;
    price?: number;
    instructor?: string;
    skill_level?: "all" | "beginner" | "intermediate" | "advanced";
  } | null;
  onSubmit: (eventId: string, eventData: any) => void;
  onDelete: (eventId: string) => void;
}

export function EditEventDialog({ 
  isOpen, 
  onClose, 
  event,
  onSubmit,
  onDelete
}: EditEventDialogProps) {
  const [eventType, setEventType] = useState<"league" | "open_play" | "private" | "lesson">("open_play");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [capacity, setCapacity] = useState("8");
  const [price, setPrice] = useState("0");
  const [instructor, setInstructor] = useState("");
  const [skillLevel, setSkillLevel] = useState<"all" | "beginner" | "intermediate" | "advanced">("all");

  useEffect(() => {
    if (event) {
      setEventType(event.event_type);
      setTitle(event.title);
      setDescription(event.description || "");
      setCapacity(event.capacity?.toString() || "8");
      setPrice(event.price?.toString() || "0");
      setInstructor(event.instructor || "");
      setSkillLevel(event.skill_level || "all");
    }
  }, [event]);

  if (!event) return null;

  const handleSubmit = () => {
    const updatedData = {
      event_type: eventType,
      title,
      description,
      capacity: eventType === "private" ? null : parseInt(capacity),
      price: parseFloat(price),
      instructor: eventType === "lesson" ? instructor : null,
      skill_level: skillLevel,
    };

    onSubmit(event.id, updatedData);
    onClose();
  };

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this event?")) {
      onDelete(event.id);
      onClose();
    }
  };

  const startTime = new Date(event.start_time);
  const endTime = new Date(event.end_time);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Event</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Event Type</Label>
            <Select value={eventType} onValueChange={(v: any) => setEventType(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open_play">Open Play</SelectItem>
                <SelectItem value="private">Private Rental</SelectItem>
                <SelectItem value="lesson">Lesson</SelectItem>
                <SelectItem value="league">League</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Title</Label>
            <Input 
              value={title} 
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Morning Open Play"
            />
          </div>

          <div>
            <Label>Description (Optional)</Label>
            <Textarea 
              value={description} 
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Event details..."
              rows={3}
            />
          </div>

          <div className="text-sm text-muted-foreground space-y-1">
            <div><strong>Date:</strong> {format(startTime, "EEEE, MMMM d, yyyy")}</div>
            <div><strong>Time:</strong> {format(startTime, "h:mm a")} - {format(endTime, "h:mm a")}</div>
          </div>

          {eventType !== "private" && (
            <>
              <div>
                <Label>Capacity</Label>
                <Input 
                  type="number" 
                  value={capacity} 
                  onChange={(e) => setCapacity(e.target.value)}
                />
              </div>

              <div>
                <Label>Skill Level</Label>
                <Select value={skillLevel} onValueChange={(v: any) => setSkillLevel(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    <SelectItem value="beginner">Beginner (2.0-2.5)</SelectItem>
                    <SelectItem value="intermediate">Intermediate (3.0-3.5)</SelectItem>
                    <SelectItem value="advanced">Advanced (4.0+)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          <div>
            <Label>Price ($)</Label>
            <Input 
              type="number" 
              step="0.01"
              value={price} 
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>

          {eventType === "lesson" && (
            <div>
              <Label>Instructor Name</Label>
              <Input 
                value={instructor} 
                onChange={(e) => setInstructor(e.target.value)}
                placeholder="e.g., Coach Sarah"
              />
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <Button onClick={handleSubmit} className="flex-1">
              Save Changes
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
