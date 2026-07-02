import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type {
  League, LeagueStatus, LeagueType, LeagueVisibility,
} from "@/lib/leagues/types";
import { logLeagueAction } from "@/lib/leagues/audit";
import { InviteCodeCard } from "./InviteCodeCard";

export function OverviewTab({
  league, onRefresh, onMutated,
}: {
  league: League;
  onRefresh: () => Promise<void> | void;
  onMutated: () => void;
}) {
  const [name, setName] = useState(league.name);
  const [description, setDescription] = useState(league.description ?? "");
  const [location, setLocation] = useState(league.location ?? "");
  const [type, setType] = useState<LeagueType>(league.league_type);
  const [status, setStatus] = useState<LeagueStatus>(league.status);
  const [visibility, setVisibility] = useState<LeagueVisibility>(league.visibility);
  const [ratingEligible, setRatingEligible] = useState(league.rating_eligible);
  const [guestsAllowed, setGuestsAllowed] = useState(league.guests_allowed);
  const [saving, setSaving] = useState(false);

  const dirty =
    name !== league.name ||
    description !== (league.description ?? "") ||
    location !== (league.location ?? "") ||
    type !== league.league_type ||
    status !== league.status ||
    visibility !== league.visibility ||
    ratingEligible !== league.rating_eligible ||
    guestsAllowed !== league.guests_allowed;

  const save = async () => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    const patch = {
      name: name.trim(),
      description: description.trim() || null,
      location: location.trim() || null,
      league_type: type,
      status,
      visibility,
      rating_eligible: ratingEligible,
      guests_allowed: guestsAllowed,
    };
    const { error } = await supabase
      .from("leagues" as never)
      .update(patch as never)
      .eq("id", league.id);
    if (error) {
      toast.error(error.message);
      setSaving(false);
      return;
    }
    await logLeagueAction({
      leagueId: league.id,
      action: "league.updated",
      entityType: "league",
      entityId: league.id,
      oldValue: {
        name: league.name, status: league.status, visibility: league.visibility,
        rating_eligible: league.rating_eligible,
      },
      newValue: patch,
    });
    toast.success("League updated");
    setSaving(false);
    await onRefresh();
    onMutated();
  };

  const archive = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("leagues" as never)
      .update({ status: "archived" } as never)
      .eq("id", league.id);
    if (error) {
      toast.error(error.message);
      setSaving(false);
      return;
    }
    await logLeagueAction({
      leagueId: league.id,
      action: "league.archived",
      entityType: "league",
      entityId: league.id,
      oldValue: { status: league.status },
      newValue: { status: "archived" },
    });
    toast.success("League archived");
    setSaving(false);
    await onRefresh();
    onMutated();
  };

  return (
    <div className="space-y-4">
      {ratingEligible && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-300">
          Rating-eligibility is currently a display flag only — the
          rating engine ignores league matches until Phase 2.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="ov-name">Name</Label>
          <Input id="ov-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ov-location">Location</Label>
          <Input
            id="ov-location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Optional"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ov-desc">Description</Label>
        <Textarea
          id="ov-desc" rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-1.5">
          <Label>League type</Label>
          <Select value={type} onValueChange={(v) => setType(v as LeagueType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="singles">Singles</SelectItem>
              <SelectItem value="doubles">Doubles</SelectItem>
              <SelectItem value="team">Team</SelectItem>
              <SelectItem value="flex">Flex</SelectItem>
              <SelectItem value="ladder">Ladder</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as LeagueStatus)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Visibility</Label>
          <Select value={visibility} onValueChange={(v) => setVisibility(v as LeagueVisibility)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="admin_only">Admin only</SelectItem>
              <SelectItem value="private">Private (future)</SelectItem>
              <SelectItem value="public_future">Public (future)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex items-center justify-between rounded-lg border border-border/70 bg-card p-3">
          <div>
            <div className="text-sm font-medium">Rating-eligible</div>
            <div className="text-xs text-muted-foreground">
              Flag only — rating engine still ignores league matches.
            </div>
          </div>
          <Switch checked={ratingEligible} onCheckedChange={setRatingEligible} />
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border/70 bg-card p-3">
          <div>
            <div className="text-sm font-medium">Guests allowed</div>
            <div className="text-xs text-muted-foreground">
              Placeholder — no player-facing UI yet.
            </div>
          </div>
          <Switch checked={guestsAllowed} onCheckedChange={setGuestsAllowed} />
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <Button onClick={save} disabled={!dirty || saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
        {league.status !== "archived" && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" className="text-destructive hover:text-destructive">
                Archive league
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Archive this league?</AlertDialogTitle>
                <AlertDialogDescription>
                  Archived leagues stay in the database and remain
                  admin-only, but move out of the default list view.
                  You can un-archive from the status dropdown.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={archive}>Archive</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {/* Invite code — separated from the main league form since it has
          its own lifecycle (set / regenerate / clear) and doesn't
          participate in the dirty/save pattern above. */}
      <InviteCodeCard league={league} onMutated={onMutated} />
    </div>
  );
}
