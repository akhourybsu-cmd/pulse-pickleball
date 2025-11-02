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

interface TournamentEvent {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  start_date: string;
  end_date: string;
  status: "draft" | "upcoming" | "live" | "completed" | "cancelled";
  public_view_enabled: boolean;
  registration_enabled: boolean;
  registration_open_date: string | null;
  registration_close_date: string | null;
  registration_fee: number;
  waitlist_enabled: boolean;
}

interface EditTournamentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: TournamentEvent;
  onSave: (updates: Partial<TournamentEvent>) => Promise<void>;
}

export function EditTournamentDialog({
  open,
  onOpenChange,
  event,
  onSave,
}: EditTournamentDialogProps) {
  const [name, setName] = useState(event.name);
  const [description, setDescription] = useState(event.description || "");
  const [location, setLocation] = useState(event.location || "");
  const [startDate, setStartDate] = useState(event.start_date);
  const [endDate, setEndDate] = useState(event.end_date);
  const [status, setStatus] = useState(event.status);
  const [publicViewEnabled, setPublicViewEnabled] = useState(event.public_view_enabled);
  const [registrationEnabled, setRegistrationEnabled] = useState(event.registration_enabled);
  const [registrationOpenDate, setRegistrationOpenDate] = useState(event.registration_open_date || "");
  const [registrationCloseDate, setRegistrationCloseDate] = useState(event.registration_close_date || "");
  const [registrationFee, setRegistrationFee] = useState(event.registration_fee.toString());
  const [waitlistEnabled, setWaitlistEnabled] = useState(event.waitlist_enabled);
  const [submitting, setSubmitting] = useState(false);

  const hasChanges =
    name !== event.name ||
    description !== (event.description || "") ||
    location !== (event.location || "") ||
    startDate !== event.start_date ||
    endDate !== event.end_date ||
    status !== event.status ||
    publicViewEnabled !== event.public_view_enabled ||
    registrationEnabled !== event.registration_enabled ||
    registrationOpenDate !== (event.registration_open_date || "") ||
    registrationCloseDate !== (event.registration_close_date || "") ||
    registrationFee !== event.registration_fee.toString() ||
    waitlistEnabled !== event.waitlist_enabled;

  const handleSubmit = async () => {
    if (!hasChanges) return;

    setSubmitting(true);
    try {
      const updates: Partial<TournamentEvent> = {};
      if (name !== event.name) updates.name = name;
      if (description !== (event.description || "")) updates.description = description || null;
      if (location !== (event.location || "")) updates.location = location || null;
      if (startDate !== event.start_date) updates.start_date = startDate;
      if (endDate !== event.end_date) updates.end_date = endDate;
      if (status !== event.status) updates.status = status;
      if (publicViewEnabled !== event.public_view_enabled) updates.public_view_enabled = publicViewEnabled;
      if (registrationEnabled !== event.registration_enabled) updates.registration_enabled = registrationEnabled;
      if (registrationOpenDate !== (event.registration_open_date || "")) 
        updates.registration_open_date = registrationOpenDate || null;
      if (registrationCloseDate !== (event.registration_close_date || "")) 
        updates.registration_close_date = registrationCloseDate || null;
      if (registrationFee !== event.registration_fee.toString()) 
        updates.registration_fee = parseFloat(registrationFee) || 0;
      if (waitlistEnabled !== event.waitlist_enabled) updates.waitlist_enabled = waitlistEnabled;

      await onSave(updates);
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Edit Tournament Event</DialogTitle>
          <DialogDescription>
            Update event details and settings
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Event Name</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-location">Location</Label>
            <Input
              id="edit-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-start-date">Start Date</Label>
              <Input
                id="edit-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-end-date">End Date</Label>
              <Input
                id="edit-end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-status">Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
              <SelectTrigger id="edit-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="upcoming">Upcoming</SelectItem>
                <SelectItem value="live">Live</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>

          <div className="space-y-4 border-t pt-4">
            <h3 className="font-semibold">Visibility & Registration Settings</h3>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="public-view">Public View</Label>
                <p className="text-sm text-muted-foreground">
                  Allow anyone to view this tournament
                </p>
              </div>
              <Switch
                id="public-view"
                checked={publicViewEnabled}
                onCheckedChange={setPublicViewEnabled}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="registration">Registration</Label>
                <p className="text-sm text-muted-foreground">
                  Enable team registration
                </p>
              </div>
              <Switch
                id="registration"
                checked={registrationEnabled}
                onCheckedChange={setRegistrationEnabled}
              />
            </div>

            {registrationEnabled && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="reg-open">Registration Opens</Label>
                    <Input
                      id="reg-open"
                      type="datetime-local"
                      value={registrationOpenDate}
                      onChange={(e) => setRegistrationOpenDate(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Leave blank for immediate</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-close">Registration Closes</Label>
                    <Input
                      id="reg-close"
                      type="datetime-local"
                      value={registrationCloseDate}
                      onChange={(e) => setRegistrationCloseDate(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Leave blank for no deadline</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reg-fee">Registration Fee ($)</Label>
                  <Input
                    id="reg-fee"
                    type="number"
                    step="0.01"
                    min="0"
                    value={registrationFee}
                    onChange={(e) => setRegistrationFee(e.target.value)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="waitlist">Waitlist</Label>
                    <p className="text-sm text-muted-foreground">
                      Enable waitlist when divisions are full
                    </p>
                  </div>
                  <Switch
                    id="waitlist"
                    checked={waitlistEnabled}
                    onCheckedChange={setWaitlistEnabled}
                  />
                </div>
              </>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!hasChanges || submitting}>
            {submitting ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
