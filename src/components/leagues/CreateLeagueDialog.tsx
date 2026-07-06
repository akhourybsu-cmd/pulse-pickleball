import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Trophy, Sparkles, Lock, ExternalLink } from "lucide-react";
import type { LeagueType } from "@/lib/leagues/types";
import { useLeagueCreationCapacity } from "@/hooks/useLeagueCreationCapacity";

/**
 * Self-serve league creation. Any authenticated user can create their
 * first league for free via the create_league RPC. A 2nd+ raises
 * SQLSTATE 53300 with HINT 'league_quota_exceeded' — we catch that
 * here and swap to a compact paywall view without navigating away.
 *
 * On success: navigate to /admin/leagues/:id so the creator lands
 * straight in the management surface they now co-own via RLS.
 */
export function CreateLeagueDialog({
  open, onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const { capacity } = useLeagueCreationCapacity();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [leagueType, setLeagueType] = useState<LeagueType>("doubles");
  const [saving, setSaving] = useState(false);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const openCheckout = async () => {
    setCheckoutLoading(true);
    const { data, error } = await supabase.functions.invoke(
      "create-league-checkout", { body: {} },
    );
    setCheckoutLoading(false);
    if (error) { toast.error(error.message ?? "Couldn't open checkout"); return; }
    const url = (data as { url?: string } | null)?.url;
    if (!url) { toast.error("Checkout URL missing"); return; }
    // Full-page redirect — Stripe checkout is a hosted page.
    window.location.href = url;
  };

  const reset = () => {
    setName(""); setDescription(""); setLocation("");
    setLeagueType("doubles");
    setSaving(false);
    setQuotaExceeded(false);
  };

  const handleClose = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  const submit = async () => {
    if (!name.trim()) { toast.error("League name is required"); return; }
    setSaving(true);
    const { data, error } = await supabase.rpc("create_league" as never, {
      p_name: name.trim(),
      p_description: description.trim() || null,
      p_location: location.trim() || null,
      p_league_type: leagueType,
    } as never);
    setSaving(false);

    if (error) {
      // Server-side freemium gate — swap to paywall view rather than
      // showing a raw error toast.
      const hint = (error as { hint?: string } | null)?.hint;
      const code = (error as { code?: string } | null)?.code;
      if (hint === "league_quota_exceeded" || code === "53300") {
        setQuotaExceeded(true);
        return;
      }
      toast.error(error.message);
      return;
    }

    toast.success("League created — start scaffolding your season");
    handleClose(false);
    // Route to the player-side manage surface — the creator is a
    // regular user, not necessarily a platform admin.
    navigate(`/player/leagues/${data as unknown as string}/manage`);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {quotaExceeded ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-600" />
                Upgrade to add more leagues
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-1">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Your first league is on us. Additional leagues need a
                subscription — one price per league, cancel anytime.
              </p>
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
                <Sparkles className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>
                  Subscribers get unlimited leagues, priority support,
                  and early access to upcoming league features.
                </span>
              </div>
              {capacity && (
                <div className="rounded-md bg-muted/40 p-2.5 text-[11px] text-muted-foreground flex items-baseline justify-between">
                  <span>You currently own</span>
                  <span className="font-mono font-semibold tabular-nums">
                    {capacity.owned} of {capacity.maxLeagues} allowed
                  </span>
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">
                Paid via Stripe. One-time charge per additional slot.
              </p>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => handleClose(false)} className="flex-1"
                disabled={checkoutLoading}>
                Not now
              </Button>
              <Button
                onClick={openCheckout}
                className="flex-1"
                disabled={checkoutLoading}
              >
                {checkoutLoading ? "Opening…" : (
                  <>Buy another slot <ExternalLink className="w-3.5 h-3.5 ml-1.5" /></>
                )}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-primary" />
                Create your league
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="new-league-name">
                  Name <span className="text-primary">*</span>
                </Label>
                <Input
                  id="new-league-name" value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Fall Doubles 2026"
                  className="h-11" autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-league-desc">Description</Label>
                <Textarea
                  id="new-league-desc" rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What is this league for?"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-league-location">Location</Label>
                <Input
                  id="new-league-location" value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Venue or general location"
                  className="h-11"
                />
              </div>
              <div className="space-y-1.5">
                <Label>League type</Label>
                <Select
                  value={leagueType}
                  onValueChange={(v) => setLeagueType(v as LeagueType)}
                >
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="singles">Singles</SelectItem>
                    <SelectItem value="doubles">Doubles</SelectItem>
                    <SelectItem value="team">Team</SelectItem>
                    <SelectItem value="flex">Flex</SelectItem>
                    <SelectItem value="ladder">Ladder</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Your first league is free. It'll start as a draft
                you can scaffold before inviting anyone.
              </p>
            </div>
            <DialogFooter>
              <Button onClick={submit} disabled={saving || !name.trim()} className="w-full h-11">
                {saving ? "Creating…" : "Create league"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
