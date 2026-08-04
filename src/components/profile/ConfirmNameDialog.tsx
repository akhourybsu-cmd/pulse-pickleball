import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Lock, ShieldCheck, Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ConfirmNameDialogProps {
  open: boolean;
  userId: string;
  initialFirstName: string | null;
  initialLastName: string | null;
  /** Called after the name is successfully locked in. */
  onConfirmed: () => void;
  /** Called when the user defers ("Not now"). */
  onDismiss: () => void;
}

/**
 * One-time prompt for EXISTING users to confirm their name of record.
 * New signups are locked at creation and never see this. Confirming here
 * flips profiles.name_locked false -> true; from then on the DB guard
 * freezes first/last. display_name is never touched.
 */
export function ConfirmNameDialog({
  open,
  userId,
  initialFirstName,
  initialLastName,
  onConfirmed,
  onDismiss,
}: ConfirmNameDialogProps) {
  const [firstName, setFirstName] = useState(initialFirstName ?? "");
  const [lastName, setLastName] = useState(initialLastName ?? "");
  const [saving, setSaving] = useState(false);

  const canConfirm = firstName.trim().length > 0 && lastName.trim().length > 0;

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          name_locked: true,
        })
        .eq("id", userId);
      if (error) throw error;
      toast.success("Name locked in");
      onConfirmed();
    } catch (error) {
      console.error("Error confirming name:", error);
      toast.error("Failed to lock in name");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onDismiss(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-1">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <DialogTitle>Confirm your name</DialogTitle>
          <DialogDescription>
            This is your name of record for leagues and tournaments. Please check the
            spelling — once you lock it in, it can't be changed here. Your display name
            stays editable.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2 py-1">
          <div className="space-y-2">
            <Label htmlFor="confirm-first-name">First Name</Label>
            <Input
              id="confirm-first-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="John"
              autoComplete="given-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-last-name">Last Name</Label>
            <Input
              id="confirm-last-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Doe"
              autoComplete="family-name"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={onDismiss} disabled={saving}>
            Not now
          </Button>
          <Button onClick={handleConfirm} disabled={!canConfirm || saving}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Locking in...
              </>
            ) : (
              <>
                <Lock className="w-4 h-4 mr-2" />
                Confirm &amp; lock in
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
