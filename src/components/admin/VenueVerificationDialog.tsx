import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  verifyVenueOwnership,
  type PlatformVenue,
} from "@/lib/admin/platformAdmin";
import { getErrorMessage } from "@/lib/getErrorMessage";
export function VenueVerificationDialog({
  venue,
  onClose,
  onSaved,
}: {
  venue: PlatformVenue;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [note, setNote] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  async function save() {
    if (
      busy ||
      !confirmed ||
      !venue.owner_id ||
      venue.private_sample ||
      note.length > 2000
    )
      return;
    setBusy(true);
    setError(null);
    try {
      await verifyVenueOwnership(venue, note, confirmed);
      await onSaved();
      toast.success("Venue ownership verified");
      onClose();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] w-[calc(100%-1rem)] max-w-lg overflow-y-auto rounded-2xl p-5 font-sans sm:p-6">
        <DialogHeader className="pr-6 text-left">
          <DialogTitle className="font-sans text-xl">
            Verify venue ownership
          </DialogTitle>
          <DialogDescription>
            Use the venue and owner already on file. No new application or
            contact fields are needed.
          </DialogDescription>
        </DialogHeader>
        <fieldset disabled={busy} className="space-y-4">
          <div className="rounded-xl border bg-muted/30 p-4">
            <p className="break-words font-semibold">{venue.name}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {[venue.city, venue.state].filter(Boolean).join(", ") ||
                "Location not provided"}
            </p>
            <p className="mt-4 text-xs text-muted-foreground">
              Current venue owner
            </p>
            <p className="mt-1 break-words text-sm font-medium">
              {venue.owner_name}
            </p>
            {venue.owner_email && (
              <p className="break-all text-sm text-muted-foreground">
                {venue.owner_email}
              </p>
            )}
          </div>
          {!venue.owner_id && (
            <p role="alert" className="text-sm text-destructive">
              Assign the correct venue owner before verifying.
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="verification-note">Decision note (optional)</Label>
            <Textarea
              id="verification-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="Add context if useful, or leave blank."
            />
            <p className="text-xs leading-5 text-muted-foreground">
              Your identity, the owner and the verification time are recorded
              automatically. If an ownership request is open, this also approves
              it and shares the note with the applicant.
            </p>
          </div>
          <label className="flex items-start gap-3 text-sm leading-6">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 shrink-0 accent-primary"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            <span>
              I confirm the owner shown above owns or is authorized to represent
              this venue.
            </span>
          </label>
          <p className="text-xs leading-5 text-muted-foreground">
            This verifies ownership. Publication and feature access are managed
            separately.
          </p>
          {error && (
            <p
              role="alert"
              className="rounded-xl border border-destructive/30 p-3 text-sm"
            >
              {error}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link
              className="text-sm underline"
              to={"/admin/venue-requests?venue=" + venue.id}
            >
              Review submitted requests
            </Link>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                disabled={
                  !confirmed || !venue.owner_id || venue.private_sample || busy
                }
                onClick={() => void save()}
              >
                {busy ? "Verifying…" : "Verify ownership"}
              </Button>
            </div>
          </div>
        </fieldset>
      </DialogContent>
    </Dialog>
  );
}
