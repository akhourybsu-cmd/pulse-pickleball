import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Calendar as CalendarIcon, CalendarDays } from "lucide-react";
import type { League, LeagueSeason, SeasonStatus } from "@/lib/leagues/types";
import { logLeagueAction } from "@/lib/leagues/audit";
import { cn } from "@/lib/utils";
import {
  EmptyState, TabSkeleton, LeagueTabProps,
  FormShell, FormSection, FormRow, FIELD_H,
} from "./_shared";

export function SeasonsTab({ league, dataVersion, onMutated }: LeagueTabProps) {
  const [seasons, setSeasons] = useState<LeagueSeason[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<LeagueSeason | null>(null);

  // dataVersion in deps → sibling-tab mutations trigger a refetch.
  useEffect(() => { void refresh(); /* eslint-disable-next-line */ }, [league.id, dataVersion]);

  const refresh = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("league_seasons" as never)
      .select("*")
      .eq("league_id", league.id)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setSeasons((data ?? []) as unknown as LeagueSeason[]);
    setLoading(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {loading ? "Loading…" : `${seasons.length} season${seasons.length === 1 ? "" : "s"}`}
        </p>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" />New season</Button>
          </DialogTrigger>
          <SeasonEditor
            league={league}
            initial={null}
            onDone={async () => { setCreateOpen(false); await refresh(); onMutated(); }}
          />
        </Dialog>
      </div>

      {loading ? (
        <TabSkeleton lines={2} />
      ) : seasons.length === 0 ? (
        <EmptyState
          icon={<CalendarIcon className="w-5 h-5" />}
          title="No seasons yet"
          desc="Start with a season — divisions, members, teams, and sessions all live inside one."
          action={{ label: "New season", onClick: () => setCreateOpen(true) }}
        />
      ) : null}

      <ul className="space-y-2">
        {seasons.map((s) => (
          <li
            key={s.id}
            className="rounded-lg border border-border/70 bg-card p-3 flex items-start justify-between gap-3"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">{s.name}</span>
                <StatusBadge status={s.status} />
              </div>
              {(s.start_date || s.end_date) && (
                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                  <CalendarIcon className="w-3 h-3" />
                  {s.start_date ?? "?"} → {s.end_date ?? "?"}
                </div>
              )}
              {s.registration_deadline && (
                <div className="text-xs text-muted-foreground mt-0.5">
                  Registration by {s.registration_deadline}
                </div>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={() => setEditing(s)}>Edit</Button>
          </li>
        ))}
      </ul>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <SeasonEditor
          league={league}
          initial={editing}
          onDone={async () => { setEditing(null); await refresh(); onMutated(); }}
        />
      </Dialog>
    </div>
  );
}

function StatusBadge({ status }: { status: SeasonStatus }) {
  const tone =
    status === "active" ? "bg-primary/15 text-primary" :
    status === "completed" ? "bg-emerald-500/15 text-emerald-500" :
    status === "archived" ? "bg-slate-500/15 text-slate-500" :
    "bg-muted text-muted-foreground";
  return (
    <span className={cn(
      "text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded",
      tone,
    )}>{status}</span>
  );
}

function SeasonEditor({
  league, initial, onDone,
}: {
  league: League;
  initial: LeagueSeason | null;
  onDone: () => void | Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [startDate, setStartDate] = useState(initial?.start_date ?? "");
  const [endDate, setEndDate] = useState(initial?.end_date ?? "");
  const [regDeadline, setRegDeadline] = useState(initial?.registration_deadline ?? "");
  const [status, setStatus] = useState<SeasonStatus>(initial?.status ?? "draft");
  const [saving, setSaving] = useState(false);
  const isNew = !initial;

  const submit = async () => {
    if (!name.trim()) { toast.error("Name is required"); return; }
    setSaving(true);
    const payload = {
      league_id: league.id,
      name: name.trim(),
      start_date: startDate || null,
      end_date: endDate || null,
      registration_deadline: regDeadline || null,
      status,
    };
    const q = isNew
      ? supabase.from("league_seasons" as never).insert(payload as never).select().single()
      : supabase.from("league_seasons" as never).update(payload as never).eq("id", initial!.id).select().single();
    const { data, error } = await q;
    if (error || !data) { toast.error(error?.message ?? "Save failed"); setSaving(false); return; }
    const saved = data as unknown as LeagueSeason;
    await logLeagueAction({
      leagueId: league.id, seasonId: saved.id,
      action: isNew ? "season.created" : "season.updated",
      entityType: "season", entityId: saved.id,
      oldValue: initial ? { name: initial.name, status: initial.status } : null,
      newValue: payload,
    });
    toast.success(isNew ? "Season created" : "Season updated");
    setSaving(false);
    await onDone();
  };

  return (
    <FormShell
      icon={<CalendarDays className="w-5 h-5" />}
      tone="primary"
      title={isNew ? "New season" : "Edit season"}
      subtitle={isNew
        ? "A season is the container for divisions, teams, sessions, and standings."
        : `Editing ${initial!.name}`}
      primaryLabel={isNew ? "Create season" : "Save changes"}
      primaryLoading={saving}
      primaryDisabled={!name.trim()}
      onPrimary={submit}
    >
      <FormSection label="Basics">
        <FormRow label="Season name" required>
          <Input
            value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Spring 2027" className={FIELD_H}
          />
        </FormRow>
        <FormRow label="Status">
          <Select value={status} onValueChange={(v) => setStatus(v as SeasonStatus)}>
            <SelectTrigger className={FIELD_H}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </FormRow>
      </FormSection>

      <FormSection label="Schedule" hint="Optional">
        <div className="grid grid-cols-2 gap-3">
          <FormRow label="Start date">
            <Input type="date" value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={FIELD_H} />
          </FormRow>
          <FormRow label="End date">
            <Input type="date" value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={FIELD_H} />
          </FormRow>
        </div>
        <FormRow
          label="Registration deadline"
          hint="After this date new joins are rejected. Existing members stay."
        >
          <Input type="date" value={regDeadline}
            onChange={(e) => setRegDeadline(e.target.value)}
            className={FIELD_H} />
        </FormRow>
      </FormSection>
    </FormShell>
  );
}
