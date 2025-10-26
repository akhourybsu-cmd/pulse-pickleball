import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

interface Event {
  id: string;
  name: string;
  notes: string | null;
  rating_eligible: boolean;
  rating_type: "ladder" | "league" | "playoffs" | "casual";
}

interface EditEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: Event;
  onSave: (updates: Partial<Event>) => Promise<void>;
}

export function EditEventDialog({ open, onOpenChange, event, onSave }: EditEventDialogProps) {
  const [name, setName] = useState(event.name);
  const [notes, setNotes] = useState(event.notes || "");
  const [ratingEligible, setRatingEligible] = useState(event.rating_eligible);
  const [ratingType, setRatingType] = useState<"ladder" | "league" | "playoffs" | "casual">(event.rating_type);
  const [saving, setSaving] = useState(false);

  const hasChanges = 
    name !== event.name ||
    notes !== (event.notes || "") ||
    ratingEligible !== event.rating_eligible ||
    ratingType !== event.rating_type;

  const handleSave = async () => {
    if (!hasChanges) return;

    setSaving(true);
    try {
      const updates: Partial<Event> = {};
      if (name !== event.name) updates.name = name;
      if (notes !== (event.notes || "")) updates.notes = notes || null;
      if (ratingEligible !== event.rating_eligible) updates.rating_eligible = ratingEligible;
      if (ratingType !== event.rating_type) updates.rating_type = ratingType;

      await onSave(updates);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Event Settings</DialogTitle>
          <DialogDescription>
            Changes to rating settings will only apply to future, unscored matches.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Event Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Event name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes or instructions"
              rows={3}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Rating Eligible</Label>
              <p className="text-sm text-muted-foreground">
                Affects future matches only
              </p>
            </div>
            <Switch
              checked={ratingEligible}
              onCheckedChange={setRatingEligible}
            />
          </div>

          {ratingEligible && (
            <div className="space-y-2">
              <Label htmlFor="rating-type">Match Type</Label>
              <Select 
                value={ratingType} 
                onValueChange={(value) => setRatingType(value as "ladder" | "league" | "playoffs" | "casual")}
              >
                <SelectTrigger id="rating-type">
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
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!hasChanges || saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
