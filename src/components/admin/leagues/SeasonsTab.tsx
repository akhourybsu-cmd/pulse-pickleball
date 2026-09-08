import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLeagueSeasons } from "@/hooks/useLeagueSeasons";
import { useAuthState } from "@/hooks/useAuthState";
import { leagueErrorMessage } from "@/lib/leagues/data";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Plus, Calendar as CalendarIcon, CalendarDays, RefreshCw,
  Users, Swords, CheckCircle2, AlertTriangle, Clock, Flag,
} from "lucide-react";
import type {
  League, LeagueSeason, SeasonStatus,
} from "@/lib/leagues/types";
import { logLeagueAction } from "@/lib/leagues/audit";
import { cn } from "@/lib/utils";
import { validateSeasonDates } from '@/lib/leagues/operations';
import {
  EmptyState, TabSkeleton, LeagueTabProps,
  FormShell, FormSection, FormRow, FIELD_H,
} from "./_shared";

interface SeasonStats {
  matches: number;
  verified: number;
  pending: number;      // scheduled + in_progress
  awaitingConfirm: number; // score_submitted
  disputed: number;
  forfeits: number;
  members: number;
}
const EMPTY_STATS: SeasonStats = {
  matches: 0, verified: 0, pending: 0,
  awaitingConfirm: 0, disputed: 0, forfeits: 0, members: 0,
};

export function SeasonsTab({ league, dataVersion, onMutated }: LeagueTabProps) {
  const { user } = useAuthState();
  const { seasons, loading: seasonsLoading, error: seasonsError, retry } = useLeagueSeasons(league.id, dataVersion);
  const aggregates = useQuery({
    queryKey: ['league-season-aggregates', user?.id, league.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_league_season_aggregates" as never, { p_league_id: league.id } as never);
      if (error) throw error;
      const stats: Record<string, SeasonStats> = {};
      for (const row of (data ?? []) as { season_id: string; matches: number; verified: number; awaiting_confirm: number; pending: number; disputed: number; forfeits: number; members: number }[]) {
        stats[row.season_id] = { ...row, awaitingConfirm: row.awaiting_confirm };
      }
      return stats;
    },
  });
  const { refetch: refetchAggregates } = aggregates;
  useEffect(() => { if (dataVersion && user?.id) void refetchAggregates(); }, [dataVersion, refetchAggregates, user?.id]);
  const stats = aggregates.data ?? {};
  const loading = seasonsLoading || aggregates.isPending;
  const error = seasonsError ?? aggregates.error;
  const refresh = async () => { await Promise.all([retry(), aggregates.refetch()]); };
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<LeagueSeason | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Show the "Sync statuses" button only when at least one season is
  // eligible for auto-advancement today. Keeps the toolbar quiet when
  // there's nothing to do. Match the database UTC date; the RPC re-checks.
  const today = new Date().toISOString().slice(0, 10);
  const syncable = seasons.some((s) => {
    if (s.status === "draft" && s.start_date && s.start_date <= today &&
        (!s.end_date || s.end_date >= today)) return true;
    if (s.status === "active" && s.end_date && s.end_date < today) return true;
    return false;
  });

  const syncStatuses = async () => {
    if (syncing) return;
    setSyncing(true);
    const { data, error } = await supabase.rpc(
      "sync_league_season_statuses" as never,
      { p_league_id: league.id } as never,
    );
    setSyncing(false);
    if (error) { toast.error(error.message); return; }
    const result = (data ?? {}) as { activated?: number; completed?: number; needs_attention?: number };
    const activated = result.activated ?? 0;
    const completed = result.completed ?? 0;
    if (activated === 0 && completed === 0 && !result.needs_attention) {
      toast.info("Everything is already in sync");
    } else {
      const parts: string[] = [];
      if (activated > 0) parts.push(`${activated} activated`);
      if (completed > 0) parts.push(`${completed} completed`);
      if (parts.length) toast.success(`Seasons synced — ${parts.join(", ")}`);
      if (result.needs_attention) toast.warning(`${result.needs_attention} season(s) still have open matches or unprocessed ladder results. Resolve those before completing.`);
    }
    await refresh();
    onMutated();
  };

  if (error) return <EmptyState title="Couldn't load seasons" desc={leagueErrorMessage(error)} action={{ label: 'Try again', onClick: () => { void refresh(); } }} />;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {loading ? "Loading…" : `${seasons.length} season${seasons.length === 1 ? "" : "s"}`}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {syncable && (
            <Button
              size="sm" variant="outline" onClick={syncStatuses}
              disabled={syncing} className="h-11 px-4 shrink-0"
              title="Advance any season past its start/end date"
            >
              <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", syncing && "animate-spin")} />
              Sync statuses
            </Button>
          )}
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-11 px-4 shrink-0 font-bold"><Plus className="w-4 h-4 mr-1.5" />New season</Button>
            </DialogTrigger>
            <SeasonEditor
              key={createOpen ? 'new-open' : 'new-closed'}
              league={league}
              initial={null}
              onDone={async () => { setCreateOpen(false); await refresh(); onMutated(); }}
            />
          </Dialog>
        </div>
      </div>

      {loading ? (
        <TabSkeleton lines={2} />
      ) : seasons.length === 0 ? (
        <EmptyState
          icon={<CalendarIcon className="w-5 h-5" />}
          title="No seasons yet"
          desc="Start with a season — members, teams, and sessions all live inside one."
          action={{ label: "New season", onClick: () => setCreateOpen(true) }}
        />
      ) : null}

      <ul className="space-y-2">
        {seasons.map((s) => {
          const st = stats[s.id] ?? EMPTY_STATS;
          // Only surface analytics for seasons that actually have data.
          // Draft with 0 rows across the board = pure clutter.
          const showAnalytics = st.matches > 0 || st.members > 0;
          return (
            <li
              key={s.id}
              className="rounded-lg border border-border/70 bg-card p-3 space-y-2.5"
            >
              <div className="flex items-start justify-between gap-3">
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
              </div>

              {showAnalytics && <SeasonAnalyticsRow stats={st} />}
            </li>
          );
        })}
      </ul>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <SeasonEditor
          key={editing?.id ?? 'closed'}
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
  const [confirmTerminal, setConfirmTerminal] = useState<null | "completed" | "archived">(null);
  const [saving, setSaving] = useState(false);
  const isNew = !initial;

  const submit = async (opts?: { confirmed?: boolean }) => {
    if (saving) return;
    if (!name.trim()) { toast.error("Name is required"); return; }
    const dateError = validateSeasonDates(startDate, endDate, regDeadline);
    if (dateError) { toast.error(dateError); return; }
    // Closing a season preserves its history and stops automatic ladder play.
    if (!isNew && initial && (status === "completed" || status === "archived")
        && initial.status !== status && !opts?.confirmed) {
      setConfirmTerminal(status);
      return;
    }
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
      kicker={isNew ? "New season" : "Season"}
      title={isNew ? "New season" : "Edit season"}
      subtitle={isNew
        ? "A season is the container for teams, sessions, and standings."
        : `Editing ${initial!.name}`}
      primaryLabel={isNew ? "Create season" : "Save changes"}
      primaryLoading={saving}
      primaryDisabled={!name.trim()}
      onPrimary={() => submit()}
    >
      <AlertDialog open={confirmTerminal !== null} onOpenChange={(o) => { if (!o) setConfirmTerminal(null); }}>
        <AlertDialogContent className="league-menu w-[calc(100%-2rem)] rounded-2xl max-h-[calc(100dvh-2rem)] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmTerminal === "archived" ? "Archive this season?" : "Mark this season complete?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmTerminal === "archived"
                ? "Archiving moves the season out of active views."
                : "Completing ends the season for standings and registration."}{" "}
              Finish, resolve, or cancel all open matches and process any remaining ladder results first.
              Closing the season also completes its ladder and turns off automatic progression. Results and membership history are preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { setConfirmTerminal(null); await submit({ confirmed: true }); }}>
              {confirmTerminal === "archived" ? "Archive season" : "Mark complete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
            <SelectContent className="league-menu">
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </FormRow>
      </FormSection>

      <FormSection label="Schedule" hint="Optional">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

/**
 * Inline stat rail for a season card. Shows:
 *  • Members count
 *  • Match totals broken down by state (verified / awaitingConfirm /
 *    pending / disputed / forfeit)
 *  • A verification progress bar when at least one match exists.
 *
 * Draft seasons with zero matches AND zero members render nothing —
 * the caller checks that before mounting us.
 */
function SeasonAnalyticsRow({ stats }: { stats: SeasonStats }) {
  // Verification rate is bounded by the scoreable universe: matches
  // that have entered the score-flow pipeline OR ended in a forfeit.
  // Pure "scheduled" matches shouldn't count against completion since
  // they haven't been played yet.
  const scoreable = stats.verified + stats.awaitingConfirm
                  + stats.disputed + stats.forfeits;
  const done = stats.verified + stats.forfeits;
  const pct = scoreable > 0 ? Math.round((done / scoreable) * 100) : 0;

  return (
    <div className="pt-2.5 border-t border-border/40 space-y-2">
      {/* Stat row — icon + count chips. Uses the same tonal language
          as the rest of the League admin: verified=emerald,
          pending=muted, awaitingConfirm=amber, disputed=destructive,
          forfeit=amber-tinted, members=primary. */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {stats.members > 0 && (
          <StatChip icon={Users} tone="primary" count={stats.members} label="members" />
        )}
        {stats.matches > 0 && (
          <StatChip icon={Swords} tone="muted" count={stats.matches} label="matches" />
        )}
        {stats.verified > 0 && (
          <StatChip icon={CheckCircle2} tone="emerald" count={stats.verified} label="verified" />
        )}
        {stats.awaitingConfirm > 0 && (
          <StatChip icon={Clock} tone="amber" count={stats.awaitingConfirm} label="to confirm" />
        )}
        {stats.pending > 0 && (
          <StatChip icon={Clock} tone="muted" count={stats.pending} label="pending" />
        )}
        {stats.disputed > 0 && (
          <StatChip icon={AlertTriangle} tone="destructive" count={stats.disputed} label="disputed" />
        )}
        {stats.forfeits > 0 && (
          <StatChip icon={Flag} tone="amber" count={stats.forfeits} label="forfeit" />
        )}
      </div>

      {/* Verification progress bar — only when there's scoreable
          matches. Explains at-a-glance how close the season is to
          fully-verified. */}
      {scoreable > 0 && (
        <div className="space-y-0.5">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span className="font-semibold uppercase tracking-wider">
              Verification
            </span>
            <span className="tabular-nums">
              {done} / {scoreable} · {pct}%
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                pct === 100 ? "bg-emerald-500" :
                stats.disputed > 0 ? "bg-destructive/70" :
                "bg-primary",
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Compact stat chip used across the analytics rail. `label` renders
 * on wider viewports; on mobile the icon + count carries the meaning
 * (with a title attribute for accessibility).
 */
function StatChip({
  icon: Icon, tone, count, label,
}: {
  icon: typeof Users;
  tone: "primary" | "muted" | "emerald" | "amber" | "destructive";
  count: number;
  label: string;
}) {
  const toneCls = {
    primary:     "bg-primary/10 text-primary",
    muted:       "bg-muted text-muted-foreground",
    emerald:     "bg-emerald-500/10 text-emerald-600",
    amber:       "bg-amber-500/10 text-amber-600",
    destructive: "bg-destructive/10 text-destructive",
  }[tone];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
        toneCls,
      )}
      title={`${count} ${label}`}
    >
      <Icon className="w-3 h-3" />
      {count}
      <span className="hidden sm:inline opacity-70 font-normal">{label}</span>
    </span>
  );
}
