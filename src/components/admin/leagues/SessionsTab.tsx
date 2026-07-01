import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Calendar as CalendarIcon } from "lucide-react";
import type {
  League, LeagueSeason, LeagueDivision, LeagueSession, SessionStatus,
} from "@/lib/leagues/types";
import { logLeagueAction } from "@/lib/leagues/audit";
import { cn } from "@/lib/utils";

export function SessionsTab({ league }: { league: League }) {
  const [seasons, setSeasons] = useState<LeagueSeason[]>([]);
  const [seasonId, setSeasonId] = useState<string | "">("");
  const [divisions, setDivisions] = useState<LeagueDivision[]>([]);
  const [sessions, setSessions] = useState<LeagueSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

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
  }, [league.id]);

  useEffect(() => {
    if (!seasonId) return;
    void reload();
    // eslint-disable-next-line
  }, [seasonId]);

  const reload = async () => {
    const [{ data: divs }, { data: sess }] = await Promise.all([
      supabase.from("league_divisions" as never).select("*").eq("season_id", seasonId),
      supabase.from("league_sessions" as never).select("*")
        .eq("season_id", seasonId).order("scheduled_date", { ascending: true }),
    ]);
    setDivisions((divs ?? []) as unknown as LeagueDivision[]);
    setSessions((sess ?? []) as unknown as LeagueSession[]);
  };

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (seasons.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Create a season first — sessions belong to a season.
      </div>
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
              league={league} seasonId={seasonId} divisions={divisions}
              onDone={async () => { setCreateOpen(false); await reload(); }}
            />
          )}
        </Dialog>
      </div>

      {sessions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No sessions scheduled.
        </div>
      ) : (
        <ul className="space-y-2">
          {sessions.map((s) => {
            const division = divisions.find((d) => d.id === s.division_id);
            return (
              <li key={s.id} className="rounded-lg border border-border/70 bg-card p-3">
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
                </div>
              </li>
            );
          })}
        </ul>
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
  league, seasonId, divisions, onDone,
}: {
  league: League;
  seasonId: string;
  divisions: LeagueDivision[];
  onDone: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [courtCount, setCourtCount] = useState("");
  const [location, setLocation] = useState(league.location ?? "");
  const [divisionId, setDivisionId] = useState<string | "none">("none");
  const [status, setStatus] = useState<SessionStatus>("draft");
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
    const { data, error } = await supabase
      .from("league_sessions" as never).insert(payload as never).select().single();
    if (error || !data) { toast.error(error?.message ?? "Save failed"); setSaving(false); return; }
    await logLeagueAction({
      leagueId: league.id, seasonId,
      action: "session.created", entityType: "session",
      entityId: (data as unknown as LeagueSession).id, newValue: payload,
    });
    toast.success("Session created");
    setSaving(false);
    await onDone();
  };

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>New session</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Week 1" />
        </div>
        <div className="space-y-1.5">
          <Label>Date</Label>
          <Input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Start</Label>
            <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>End</Label>
            <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Courts</Label>
            <Input type="number" min="1" value={courtCount} onChange={(e) => setCourtCount(e.target.value)} placeholder="4" />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as SessionStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="canceled">Canceled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Location</Label>
          <Input value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Division (optional)</Label>
          <Select value={divisionId} onValueChange={setDivisionId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">All divisions</SelectItem>
              {divisions.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={saving} className="w-full">
          {saving ? "Creating…" : "Create session"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
