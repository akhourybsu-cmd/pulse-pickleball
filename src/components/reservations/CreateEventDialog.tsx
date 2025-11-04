import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";

interface CreateEventDialogProps {
  isOpen: boolean;
  onClose: () => void;
  defaultDate?: Date;
  defaultHour?: number;
  defaultCourt?: number;
  onSubmit: (eventData: any) => void;
}

export function CreateEventDialog({ 
  isOpen, 
  onClose, 
  defaultDate, 
  defaultHour = 8, 
  defaultCourt = 1,
  onSubmit 
}: CreateEventDialogProps) {
  const [eventType, setEventType] = useState<"league" | "open_play" | "private" | "lesson">("open_play");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [capacity, setCapacity] = useState("8");
  const [price, setPrice] = useState("0");
  const [instructor, setInstructor] = useState("");
  const [duration, setDuration] = useState("60");
  const [skillLevel, setSkillLevel] = useState<"all" | "beginner" | "intermediate" | "advanced">("all");

  const handleSubmit = () => {
    const eventData = {
      event_type: eventType,
      title,
      description,
      start_time: defaultDate ? new Date(defaultDate).setHours(defaultHour, 0) : new Date(),
      duration: parseInt(duration),
      court_number: defaultCourt,
      capacity: eventType === "private" ? null : parseInt(capacity),
      price: parseFloat(price),
      instructor: eventType === "lesson" ? instructor : null,
      skill_level: skillLevel,
    };
    onSubmit(eventData);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Event</DialogTitle>
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

          {defaultDate && (
            <div className="text-sm text-muted-foreground">
              <strong>Date:</strong> {format(defaultDate, "EEEE, MMMM d, yyyy")}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Duration (minutes)</Label>
              <Input 
                type="number" 
                value={duration} 
                onChange={(e) => setDuration(e.target.value)}
              />
            </div>

            <div>
              <Label>Court</Label>
              <Select value={String(defaultCourt)} onValueChange={() => {}}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Court 1</SelectItem>
                  <SelectItem value="2">Court 2</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
              Create Event
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
