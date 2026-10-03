import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Loader2, Mail, Link as LinkIcon, UserPlus } from "lucide-react";
import { PremiumDialogHeader } from "./PremiumDialogHeader";
import { supabase } from "@/integrations/supabase/client";
import { requireGuestResult, sendGuestInvitation } from "@/lib/guests";
import { useAuthState } from "@/hooks/useAuthState";
import { toast } from "sonner";

interface GuestInviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guestPlayerId: string;
  guestDisplayName: string;
  defaultEmail?: string | null;
}
const claimLink = (token: string) => `https://pulsepb.com/claim-guest/${token}`;

export function GuestInviteDialog({ open, onOpenChange, guestPlayerId, guestDisplayName, defaultEmail }: GuestInviteDialogProps) {
  const { user } = useAuthState();
  const qc = useQueryClient();
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const requestRef = useRef<{ id: string; email: string | null; guest: string } | null>(null);
  const generation = useRef(0);
  const [created, setCreated] = useState<{ id: string; link: string; email: string | null } | null>(null);
  const [delivery, setDelivery] = useState<string | null>(null);
  const [failedEmail, setFailedEmail] = useState(false);
  useEffect(() => {
    generation.current += 1;
    setCreated(null); setDelivery(null); setFailedEmail(false);
    setEmail(defaultEmail ?? ""); requestRef.current = null;
    return () => { generation.current += 1; };
  }, [open, guestPlayerId, defaultEmail]);

  const invites = useQuery({
    queryKey: ["guest-invites", user?.id, guestPlayerId], enabled: open && !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("guest_claim_invites")
        .select("id, token, status, invited_email, expires_at, email_queued_at")
        .eq("guest_player_id", guestPlayerId).in("status", ["pending", "awaiting_approval"])
        .gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["guest-invites"] });
    void qc.invalidateQueries({ queryKey: ["pending-guest-claims"] });
  };
  const emailInvite = async (id: string, current: number) => {
    try {
      await sendGuestInvitation(id);
      if (generation.current !== current) return;
      setFailedEmail(false); setDelivery("Email queued for delivery.");
      toast.success("Invitation email queued");
    } catch (error) {
      if (generation.current !== current) return;
      setFailedEmail(true);
      setDelivery(error instanceof Error ? error.message : "Email could not be queued. Copy the link below.");
    }
  };
  const createInvite = async (withEmail: boolean) => {
    if (busyRef.current) return;
    const address = withEmail ? email.trim().toLowerCase() : null;
    if (withEmail && (!address || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address))) {
      toast.error("Enter a valid email address."); return;
    }
    busyRef.current = true; setBusy(true);
    const current = generation.current;
    try {
      if (!requestRef.current || requestRef.current.email !== address || requestRef.current.guest !== guestPlayerId) {
        requestRef.current = { id: crypto.randomUUID(), email: address, guest: guestPlayerId };
      }
      const { data, error } = await supabase.rpc("create_guest_claim_invite", {
        _guest_id: guestPlayerId, _email: address, _request_id: requestRef.current.id,
      });
      const result = requireGuestResult<{ ok: boolean; invite_id: string; token: string }>(data, error);
      if (generation.current !== current) return;
      setCreated({ id: result.invite_id, link: claimLink(result.token), email: address });
      if (address) await emailInvite(result.invite_id, current);
      refresh();
    } catch (error) {
      if (generation.current === current) toast.error(error instanceof Error ? error.message : "Could not create invitation.");
    } finally { busyRef.current = false; setBusy(false); }
  };
  const retryEmail = async (id: string) => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true);
    try { await emailInvite(id, generation.current); refresh(); }
    finally { busyRef.current = false; setBusy(false); }
  };
  const copy = async (value: string) => {
    try { await navigator.clipboard.writeText(value); toast.success("Invitation copied"); }
    catch { toast.error("Could not copy. Select and copy the claim link manually."); }
  };
  const revoke = async (id: string) => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true);
    try {
      const { data, error } = await supabase.rpc("revoke_guest_claim_invite", { _invite_id: id });
      requireGuestResult(data, error);
      if (created?.id === id) { setCreated(null); setDelivery(null); requestRef.current = null; }
      refresh(); toast.success("Invitation revoked");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not revoke invitation."); }
    finally { busyRef.current = false; setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={(value) => { if (!busyRef.current) onOpenChange(value); }}>
      <DialogContent className="sm:max-w-md max-h-[85dvh] overflow-y-auto">
        <PremiumDialogHeader icon={UserPlus} eyebrow="Guest profile"
          title={created ? "Invitation ready" : "Invite to claim profile"}
          description={<>Let <strong className="text-foreground">{guestDisplayName}</strong> connect their playing history to a PULSE account.</>} />
        {!created ? <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email (optional)</Label>
            <Input id="invite-email" type="email" maxLength={254} placeholder="player@email.com" value={email} disabled={busy} onChange={(e) => setEmail(e.target.value)} />
            <p className="text-xs text-muted-foreground">A verified matching account links automatically. Other accounts need your approval.</p>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" disabled={busy} onClick={() => createInvite(false)}><LinkIcon className="h-4 w-4 mr-2" />Create share link</Button>
            <Button disabled={busy || !email.trim()} onClick={() => createInvite(true)}>{busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}Send email invite</Button>
          </DialogFooter>
        </div> : <div className="space-y-3 py-2">
          {delivery && <p role="status" className={failedEmail ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>{delivery}</p>}
          {failedEmail && created.email && <Button variant="outline" disabled={busy} onClick={() => retryEmail(created.id)}>Retry email</Button>}
          <Label htmlFor="guest-claim-link">Claim link</Label>
          <div className="flex gap-2"><Input id="guest-claim-link" readOnly value={created.link} className="font-mono text-xs" /><Button variant="outline" aria-label="Copy claim link" onClick={() => copy(created.link)}><Copy className="h-4 w-4" /></Button></div>
          <Button variant="secondary" className="w-full" onClick={() => copy(`Your PULSE guest profile is ready. Sign in or create an account to connect your playing history: ${created.link}`)}>Copy invitation message</Button>
          <p className="text-xs text-muted-foreground">This link expires in 30 days. Manage active invitations below.</p>
        </div>}
        {invites.isError && <div role="alert" className="text-sm">Couldn't load active invitations. <Button variant="link" onClick={() => invites.refetch()}>Retry</Button></div>}
        {!!invites.data?.length && <div className="space-y-2 border-t pt-3">
          <h3 className="text-sm font-semibold">Active invitations</h3>
          {invites.data.map((invite) => <div key={invite.id} className="rounded-lg border p-3 space-y-2">
            <p className="text-sm break-all">{invite.invited_email ?? "Share link"}</p>
            <p className="text-xs text-muted-foreground">{invite.status === "awaiting_approval" ? "Needs your approval in Guest Roster" : invite.email_queued_at ? "Email queued" : "Link ready"} · Expires {new Date(invite.expires_at).toLocaleDateString()}</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => copy(claimLink(invite.token))}>Copy link</Button>
              {invite.status === "pending" && invite.invited_email && !invite.email_queued_at && <Button size="sm" variant="outline" disabled={busy} onClick={() => retryEmail(invite.id)}>Send email</Button>}
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => revoke(invite.id)}>Revoke</Button>
            </div>
          </div>)}
        </div>}
        <DialogFooter><Button disabled={busy} onClick={() => onOpenChange(false)}>Done</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
