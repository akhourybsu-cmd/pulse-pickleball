import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { AlertTriangle } from "lucide-react";
import type {
  League, LeagueStatus, LeagueType, LeagueVisibility,
} from "@/lib/leagues/types";
import { logLeagueAction } from "@/lib/leagues/audit";
import { InviteCodeCard } from "./InviteCodeCard";
import { FormSection, FormRow, FIELD_H } from "./_shared";
import { cn } from "@/lib/utils";

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
    <div className="space-y-6">
      {ratingEligible && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>
            Rating-eligibility is currently a display flag only — the
            rating engine ignores league matches until Phase 2.
          </span>
        </div>
      )}

      {/* Main card — grouped form with sticky-looking save row */}
      <div className="rounded-xl border border-border/70 bg-card p-5 space-y-5">
        <FormSection label="Identity">
          <div className="grid gap-3 md:grid-cols-2">
            <FormRow label="League name" htmlFor="ov-name" required>
              <Input id="ov-name" value={name}
                onChange={(e) => setName(e.target.value)}
                className={FIELD_H} />
            </FormRow>
            <FormRow label="Location" htmlFor="ov-location">
              <Input id="ov-location" value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Optional" className={FIELD_H} />
            </FormRow>
          </div>
          <FormRow label="Description" htmlFor="ov-desc">
            <Textarea id="ov-desc" rows={3} value={description}
              onChange={(e) => setDescription(e.target.value)} />
          </FormRow>
        </FormSection>

        <FormSection label="Format">
          <div className="grid gap-3 md:grid-cols-3">
            <FormRow label="League type">
              <Select value={type} onValueChange={(v) => setType(v as LeagueType)}>
                <SelectTrigger className={FIELD_H}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="singles">Singles</SelectItem>
                  <SelectItem value="doubles">Doubles</SelectItem>
                  <SelectItem value="team">Team</SelectItem>
                  <SelectItem value="flex">Flex</SelectItem>
                  <SelectItem value="ladder">Ladder</SelectItem>
                </SelectContent>
              </Select>
            </FormRow>
            <FormRow label="Status">
              <Select value={status} onValueChange={(v) => setStatus(v as LeagueStatus)}>
                <SelectTrigger className={FIELD_H}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </FormRow>
            <FormRow label="Visibility">
              <Select value={visibility} onValueChange={(v) => setVisibility(v as LeagueVisibility)}>
                <SelectTrigger className={FIELD_H}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin_only">Admin only</SelectItem>
                  <SelectItem value="private">Private (future)</SelectItem>
                  <SelectItem value="public_future">Public (future)</SelectItem>
                </SelectContent>
              </Select>
            </FormRow>
          </div>
        </FormSection>

        <FormSection label="Toggles">
          <div className="grid gap-3 md:grid-cols-2">
            <ToggleCard
              label="Rating-eligible"
              desc="Flag only — rating engine still ignores league matches."
              checked={ratingEligible} onChange={setRatingEligible}
            />
            <ToggleCard
              label="Guests allowed"
              desc="Placeholder — no player-facing UI yet."
              checked={guestsAllowed} onChange={setGuestsAllowed}
            />
          </div>
        </FormSection>

        {/* Save row */}
        <div className="flex items-center justify-between pt-3 border-t border-border/40">
          <Button
            onClick={save} disabled={!dirty || saving}
            className={cn(
              "h-11 font-semibold px-6",
              dirty && "shadow-[0_2px_8px_-2px_hsl(var(--primary)/0.4)]",
            )}
          >
            {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
          </Button>
          {league.status !== "archived" && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" className="text-muted-foreground hover:text-destructive">
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
      </div>

      {/* Invite code — separated from the main league form since it has
          its own lifecycle (set / regenerate / clear) and doesn't
          participate in the dirty/save pattern above. */}
      <InviteCodeCard league={league} onMutated={onMutated} />
    </div>
  );
}

function ToggleCard({
  label, desc, checked, onChange,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
        checked
          ? "border-primary/40 bg-primary/5"
          : "border-border/70 bg-card hover:border-border",
      )}
    >
      <div className="min-w-0">
        <div className="text-sm font-semibold">{label}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}
