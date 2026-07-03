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
import {
  Plus, Calendar as CalendarIcon, ChevronRight, CalendarClock,
} from "lucide-react";
import type {
  League, LeagueSeason, LeagueDivision, LeagueSession, SessionStatus,
} from "@/lib/leagues/types";
import { logLeagueAction } from "@/lib/leagues/audit";
import { cn } from "@/lib/utils";
import {
  EmptyState, TabSkeleton, LeagueTabProps,
  FormShell, FormSection, FormRow, FIELD_H,
} from "./_shared";

export function SessionsTab({ league, dataVersion, onMutated }: LeagueTabProps) {
  const [seasons, setSeasons] = useState<LeagueSeason[]>([]);
  const [seasonId, setSeasonId] = useState<string | "">("");
  const [divisions, setDivisions] = useState<LeagueDivision[]>([]);
  const [sessions, setSessions] = useState<LeagueSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<LeagueSession | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("league_seasons" as never).select("*")
        .eq("league_id", league.id).order("created_at", { ascending: false });
      const list = (data ?? []) as unknown as LeagueSeason[];
      setSeasons(list);
      if (list.length && !seasonId) setSeasonId(list[0].id);
      setLoading(false);
    })();
    // eslint-disable-next-line
  }, [league.id, dataVersion]);

  useEffect(() => {
    if (!seasonId) return;
    void reload();
    // eslint-disable-next-line
  }, [seasonId, dataVersion]);

  const reload = async () => {
    const [{ data: divs }, { data: sess }] = await Promise.all([
      supabase.from("league_divisions" as never).select("*").eq("season_id", seasonId),
      supabase.from("league_sessions" as never).select("*")
        .eq("season_id", seasonId).order("scheduled_date", { ascending: true }),
    ]);
    setDivisions((divs ?? []) as unknown as LeagueDivision[]);
    setSessions((sess ?? []) as unknown as LeagueSession[]);
  };

  if (loading) return <TabSkeleton lines={3} />;
  if (seasons.length === 0) {
    return (
      <EmptyState
        icon={<CalendarClock className="w-5 h-5" />}
        title="Create a season first"
        desc="Sessions live inside a season."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Select value={seasonId} onValueChange={setSeasonId}>
          <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            {seasons.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" />New session</Button>
          </DialogTrigger>
          {seasonId && (
            <SessionEditor
              mode="create"
              league={league} seasonId={seasonId} divisions={divisions} initial={null}
              onDone={async () => { setCreateOpen(false); await reload(); onMutated(); }}
            />
          )}
        </Dialog>
      </div>

      {sessions.length === 0 ? (
        <EmptyState
          icon={<CalendarIcon className="w-5 h-5" />}
          title="No sessions scheduled"
          desc="Add the first session to lay out your league calendar."
        />
      ) : (
        <ul className="space-y-2">
          {sessions.map((s) => {
            const division = divisions.find((d) => d.id === s.division_id);
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setEditing(s)}
                  className="w-full text-left rounded-lg border border-border/70 bg-card p-3 hover:bg-muted/50 hover:border-primary/40 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{s.name}</span>
                        <SessionStatusBadge status={s.status} />
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                        <CalendarIcon className="w-3 h-3" />
                        <span>{s.scheduled_date ?? "No date"}</span>
                        {s.start_time && <span>{s.start_time}{s.end_time ? `–${s.end_time}` : ""}</span>}
                        {s.court_count && <span>{s.court_count} courts</span>}
                        {division && <span>{division.name}</span>}
                      </div>
                      {s.location && (
                        <div className="text-xs text-muted-foreground mt-0.5">{s.location}</div>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {editing && (
        <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
          <SessionEditor
            mode="edit"
            league={league} seasonId={seasonId as string}
            divisions={divisions} initial={editing}
            onDone={async () => { setEditing(null); await reload(); onMutated(); }}
          />
        </Dialog>
      )}
    </div>
  );
}

function SessionStatusBadge({ status }: { status: SessionStatus }) {
  const tone =
    status === "published" ? "bg-primary/15 text-primary" :
    status === "completed" ? "bg-emerald-500/15 text-emerald-500" :
    status === "canceled" ? "bg-destructive/15 text-destructive" :
    "bg-muted text-muted-foreground";
  return (
    <span className={cn(
      "text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded",
      tone,
    )}>{status}</span>
  );
}

function SessionEditor({
  mode, league, seasonId, divisions, initial, onDone,
}: {
  mode: "create" | "edit";
  league: League;
  seasonId: string;
  divisions: LeagueDivision[];
  initial: LeagueSession | null;
  onDone: () => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [scheduledDate, setScheduledDate] = useState(initial?.scheduled_date ?? "");
  const [startTime, setStartTime] = useState(initial?.start_time ?? "");
  const [endTime, setEndTime] = useState(initial?.end_time ?? "");
  const [courtCount, setCourtCount] = useState(initial?.court_count?.toString() ?? "");
  const [location, setLocation] = useState(initial?.location ?? league.location ?? "");
  const [divisionId, setDivisionId] = useState<string | "none">(initial?.division_id ?? "none");
  const [status, setStatus] = useState<SessionStatus>(initial?.status ?? "draft");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) { toast.error("Name is required"); return; }
    setSaving(true);
    const payload = {
      league_id: league.id,
      season_id: seasonId,
      division_id: divisionId === "none" ? null : divisionId,
      name: name.trim(),
      scheduled_date: scheduledDate || null,
      start_time: startTime || null,
      end_time: endTime || null,
      court_count: courtCount ? Number(courtCount) : null,
      location: location.trim() || null,
      status,
    };
    const q = mode === "create"
      ? supabase.from("league_sessions" as never).insert(payload as never).select().single()
      : supabase.from("league_sessions" as never).update(payload as never).eq("id", initial!.id).select().single();
    const { data, error } = await q;
    if (error || !data) { toast.error(error?.message ?? "Save failed"); setSaving(false); return; }
    const saved = data as unknown as LeagueSession;
    await logLeagueAction({
      leagueId: league.id, seasonId,
      action: mode === "create" ? "session.created" : "session.updated",
      entityType: "session", entityId: saved.id,
      oldValue: initial ? { name: initial.name, status: initial.status } : null,
      newValue: payload,
    });
    toast.success(mode === "create" ? "Session created" : "Session updated");
    setSaving(false);
    await onDone();
  };

  return (
    <FormShell
      icon={<CalendarClock className="w-5 h-5" />}
      tone="violet"
      title={mode === "create" ? "New session" : "Edit session"}
      subtitle={mode === "create"
        ? "One night of play. Publishing surfaces it to enrolled players."
        : `Editing ${initial!.name}`}
      primaryLabel={mode === "create" ? "Create session" : "Save changes"}
      primaryLoading={saving}
      primaryDisabled={!name.trim()}
      onPrimary={submit}
    >
      <FormSection label="Basics">
        <FormRow label="Session name" required>
          <Input value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Week 1" className={FIELD_H} />
        </FormRow>
        <FormRow label="Status">
          <Select value={status} onValueChange={(v) => setStatus(v as SessionStatus)}>
            <SelectTrigger className={FIELD_H}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft (hidden from players)</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="canceled">Canceled</SelectItem>
            </SelectContent>
          </Select>
        </FormRow>
      </FormSection>

      <FormSection label="Schedule">
        <FormRow label="Date">
          <Input type="date" value={scheduledDate}
            onChange={(e) => setScheduledDate(e.target.value)}
            className={FIELD_H} />
        </FormRow>
        <div className="grid grid-cols-2 gap-3">
          <FormRow label="Start time">
            <Input type="time" value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className={FIELD_H} />
          </FormRow>
          <FormRow label="End time">
            <Input type="time" value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className={FIELD_H} />
          </FormRow>
        </div>
      </FormSection>

      <FormSection label="Venue & division">
        <div className="grid grid-cols-2 gap-3">
          <FormRow label="Courts">
            <Input type="number" min="1" value={courtCount}
              onChange={(e) => setCourtCount(e.target.value)}
              placeholder="4" className={FIELD_H} />
          </FormRow>
          <FormRow label="Location">
            <Input value={location} onChange={(e) => setLocation(e.target.value)}
              className={FIELD_H} placeholder="Optional" />
          </FormRow>
        </div>
        <FormRow
          label="Division"
          hint="Leave open to schedule across all divisions."
        >
          <Select value={divisionId} onValueChange={setDivisionId}>
            <SelectTrigger className={FIELD_H}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">All divisions</SelectItem>
              {divisions.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </FormRow>
      </FormSection>
    </FormShell>
  );
}
