import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Key, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { withAuthDeadline } from "@/lib/authDeadline";
import { roundRobinPath } from "@/lib/roundRobin/sharing";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialCode?: string;
  autoPreviewOnOpen?: boolean;
}

/** Code entry and legacy ?invite links lead to the same public event page. */
export function JoinByInviteCodeDialog({ open, onOpenChange, initialCode = "", autoPreviewOnOpen = false }: Props) {
  const navigate = useNavigate();
  const [code, setCode] = useState(initialCode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);
  const cancelRequest = useCallback(() => { request.current++; }, []);
  const lookup = async (raw: string) => {
    const current = ++request.current;
    setLoading(true); setError(null);
    try {
      const normalized = raw.trim().toUpperCase();
      const { data, error: rpcError } = await withAuthDeadline(signal => supabase.rpc("preview_round_robin_by_code", { p_code: normalized }).abortSignal(signal));
      if (current !== request.current) return;
      if (rpcError) throw rpcError;
      const event = data?.[0];
      if (!event) throw new Error("Invalid invite code");
      onOpenChange(false);
      navigate(roundRobinPath(event.event_id, normalized));
    } catch (failure) {
      if (current === request.current) {
        const message = (failure as { message?: string })?.message;
        setError(message?.includes("Invalid invite code") ? "That code could not be found. Check it or ask the host for a new invitation." : "The event could not load. Please try again.");
      }
    } finally { if (current === request.current) setLoading(false); }
  };
  useEffect(() => {
    setCode(initialCode); setError(null); setLoading(false);
    if (open && initialCode && autoPreviewOnOpen) void lookup(initialCode);
    return cancelRequest;
    // Opening the dialog is the intent; callback identity changes must not restart a lookup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialCode, autoPreviewOnOpen, cancelRequest]);
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-md">
      <DialogHeader><DialogTitle className="flex items-center gap-2"><Key className="h-5 w-5 text-primary" />Join with an invite code</DialogTitle><DialogDescription>Enter the host’s code to view the event and register. Codes are not case sensitive.</DialogDescription></DialogHeader>
      <form className="space-y-4" onSubmit={e => { e.preventDefault(); if (code.trim() && !loading) void lookup(code); }}>
        <div className="space-y-2"><Label htmlFor="rr-invite-code">Invite code</Label><Input id="rr-invite-code" placeholder="XYZ-ABCD" autoFocus maxLength={20} value={code} disabled={loading} onChange={e => setCode(e.target.value.toUpperCase())} className="h-14 text-center font-mono text-xl tracking-widest" /></div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={!code.trim() || loading}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{loading ? "Finding event…" : "View Event"}</Button>
      </form>
    </DialogContent>
  </Dialog>;
}
