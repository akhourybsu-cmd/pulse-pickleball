import { useEffect, useState } from "react";
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
import { Copy, Loader2, Mail, Link as LinkIcon, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface GuestInviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guestPlayerId: string;
  guestDisplayName: string;
  defaultEmail?: string | null;
}

function makeToken() {
  // 24-char URL-safe token
  const a = new Uint8Array(18);
  crypto.getRandomValues(a);
  return btoa(String.fromCharCode(...a))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function GuestInviteDialog({
  open,
  onOpenChange,
  guestPlayerId,
  guestDisplayName,
  defaultEmail,
}: GuestInviteDialogProps) {
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [creating, setCreating] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      setShareLink(null);
      setEmail(defaultEmail ?? "");
      setCopied(false);
    }
  }, [open, defaultEmail]);

  const createInvite = async (opts: { withEmail: boolean }) => {
    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("not_authenticated");
      const token = makeToken();
      const requiresApproval = !opts.withEmail;
      const invitedEmail = opts.withEmail ? email.trim() || null : null;

      const { error } = await supabase.from("guest_claim_invites").insert({
        guest_player_id: guestPlayerId,
        token,
        invited_email: invitedEmail,
        created_by: user.id,
        requires_approval: requiresApproval,
      } as never);
      if (error) throw error;

      const link = `${window.location.origin}/claim-guest/${token}`;

      if (opts.withEmail && invitedEmail) {
        // Best-effort email send; if template isn't registered, the share
        // link still works.
        try {
          await supabase.functions.invoke("send-transactional-email", {
            body: {
              templateName: "guest-claim-invite",
              recipientEmail: invitedEmail,
              idempotencyKey: `guest-claim-${token}`,
              templateData: {
                guestName: guestDisplayName,
                claimUrl: link,
              },
            },
          });
          toast.success(`Invite sent to ${invitedEmail}`);
        } catch (e) {
          console.warn("Email send failed; share link still available", e);
          toast.message("Invite created — share the link manually if needed.");
        }
      }

      setShareLink(link);
    } catch (e) {
      console.error(e);
      toast.error("Could not create invite.");
    } finally {
      setCreating(false);
    }
  };

  const inviteMessage = shareLink
    ? `You've been added as a guest player in PULSE for a round robin. Claim your profile to connect your account and keep your playing history linked:\n\n${shareLink}`
    : "";

  const copyLink = async () => {
    if (!shareLink) return;
    await navigator.clipboard.writeText(shareLink);
    setCopied(true);
    toast.success("Claim link copied");
    setTimeout(() => setCopied(false), 1500);
  };

  const copyMessage = async () => {
    if (!inviteMessage) return;
    await navigator.clipboard.writeText(inviteMessage);
    toast.success("Invite message copied — paste into a text or DM");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {shareLink ? "Invite ready" : "Invite to claim profile"}
          </DialogTitle>
          <DialogDescription>
            Let <strong>{guestDisplayName}</strong> link their guest history
            to a registered PULSE account.
          </DialogDescription>
        </DialogHeader>

        {!shareLink ? (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email (optional)</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="player@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                If their account email matches the one above, the link is
                automatic — otherwise you'll review it before merging.
              </p>
            </div>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                variant="outline"
                disabled={creating}
                onClick={() => createInvite({ withEmail: false })}
              >
                <LinkIcon className="h-4 w-4 mr-2" />
                Create share link
              </Button>
              <Button
                disabled={creating || !email.trim()}
                onClick={() => createInvite({ withEmail: true })}
              >
                {creating ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Mail className="h-4 w-4 mr-2" />
                )}
                Send email invite
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <Label>Claim link</Label>
            <div className="flex gap-2">
              <Input readOnly value={shareLink} className="font-mono text-xs" />
              <Button variant="outline" onClick={copyLink}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <Button
              variant="secondary"
              className="w-full"
              onClick={copyMessage}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy invite message
            </Button>
            <p className="text-xs text-muted-foreground">
              The link expires in 30 days. You can revoke it from the guest
              roster.
            </p>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </DialogFooter>
          </div>
        )}

      </DialogContent>
    </Dialog>
  );
}
