import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Layers, Trophy, ArrowUp, ArrowDown, Minus, Info, Play, Pause, CheckCircle2,
  ChevronUp, ChevronDown, RotateCcw, Zap, Swords, UserX, Users, AlertTriangle,
  CalendarClock,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import type { League, LeagueSeason } from "@/lib/leagues/types";
import { resolvePlayerName } from "@/lib/matchDisplay";
import { formatDistanceToNow } from "date-fns";
import { gamesPerPlayer } from "@/lib/leagues/ladder";
import {
  useLadder, type LadderGame, type LadderGroup, type LadderMovementRow,
} from "@/hooks/useLadder";
import { cn } from "@/lib/utils";
import {
  EmptyState, TabSkeleton, LeagueTabProps, FormSection, FormRow, FIELD_H,
  SeasonSelect, ChoiceGrid, SegmentedControl,
} from "./_shared";

/**
 * Schedule (or reschedule) a ladder week's session via the RPC, which binds
 * the league_sessions row to (season, week_number). Returns the session id,
 * or null after toasting the error. One scheduling path for the whole ladder.
 */
async function scheduleLadderWeek(
  leagueId: string,
  seasonId: string,
  weekNumber: number,
  d: {
    scheduled_date: string; start_time: string; end_time: string;
    location: string; court_count: number | null; capacity: number | null;
  },
): Promise<string | null> {
  const { data, error } = await supabase.rpc("schedule_ladder_week" as never, {
    p_league_id: leagueId,
    p_season_id: seasonId,
    p_week_number: weekNumber,
    p_scheduled_date: d.scheduled_date || null,
    p_start_time: d.start_time || null,
    p_end_time: d.end_time || null,
    p_location: d.location || null,
    p_court_count: d.court_count,
    p_capacity: d.capacity,
  } as never);
  if (error) {
    toast.error(error.message ?? "Couldn't schedule the week");
    return null;
  }
  return (data as { session_id?: string } | null)?.session_id ?? null;
}

export function LadderTab({ league, dataVersion, onMutated }: LeagueTabProps) {
  const [seasons, setSeasons] = useState<LeagueSeason[]>([]);
  const [seasonId, setSeasonId] = useState<string | "">("");
  const [loadingSeasons, setLoadingSeasons] = useState(true);
  const [ver, setVer] = useState(0);
  const ladder = useLadder(league.id, seasonId, dataVersion + ver);
  const bump = () => { setVer((v) => v + 1); onMutated(); };

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("league_seasons" as never).select("*")
        .eq("league_id", league.id).order("created_at", { ascending: false });
      const list = (data ?? []) as unknown as LeagueSeason[];
      setSeasons(list);
      if (list.length && !seasonId) setSeasonId(list[0].id);
      setLoadingSeasons(false);
    })();
    // eslint-disable-next-line
  }, [league.id, dataVersion]);

  if (league.league_type !== "ladder") {
    return (
      <EmptyState
        icon={<Layers className="w-5 h-5" />}
        title="This is not a ladder league"
        desc="Set the league type to Ladder on the Overview tab to run an individual doubles ladder."
      />
    );
  }
  if (loadingSeasons) return <TabSkeleton lines={4} />;
  if (seasons.length === 0) {
    return (
      <EmptyState
        icon={<Layers className="w-5 h-5" />}
        title="Create a season first"
        desc="A ladder runs inside a season — add one on the Seasons tab."
      />
    );
  }

  return (
    <div className="space-y-3">
      <SeasonSelect seasons={seasons} value={seasonId} onChange={setSeasonId} className="w-full" />

      {ladder.loading ? (
        <TabSkeleton lines={4} />
      ) : !ladder.settings ? (
        <LadderSetup leagueId={league.id} seasonId={seasonId} onSaved={bump} />
      ) : !ladder.started ? (
        <LadderStart league={league} seasonId={seasonId} ladder={ladder} onStarted={bump} />
      ) : (
        <LadderManage league={league} ladder={ladder} onChanged={bump} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Setup — configure the ladder for this season                       */
/* ------------------------------------------------------------------ */

function LadderSetup({
  leagueId, seasonId, onSaved,
}: {
  leagueId: string;
  seasonId: string;
  onSaved: () => void;
}) {
  const [batches, setBatches] = useState(1);
  const [courts, setCourts] = useState("2");
  const [weeks, setWeeks] = useState("8");
  const [scoring, setScoring] = useState("to_11_win_by_2");
  const [source, setSource] = useState<"manual" | "pulse_rating" | "random">("pulse_rating");
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [selfReport, setSelfReport] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("ladder_settings" as never).insert({
      league_id: leagueId, season_id: seasonId,
      batches_per_week: batches,
      court_count: Math.max(1, Number(courts) || 1),
      total_weeks: weeks ? Number(weeks) : null,
      movement_rule: "one_up_one_down",
      scoring_format: scoring,
      initial_order_source: source,
      auto_advance: autoAdvance,
      self_report_scoring: selfReport,
      status: "setup",
    } as never);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Ladder configured");
    onSaved();
  };

  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 space-y-5">
      <LadderExplainerInline />

      <FormSection label="Format">
        <FormRow label="Batches per week" hint="One batch = one rotating-partner round.">
          <ChoiceGrid
            columns={3}
            value={String(batches)}
            onChange={(v) => setBatches(Number(v))}
            options={[
              { value: "1", label: "1 batch", desc: `${gamesPerPlayer(1)} games / player` },
              { value: "2", label: "2 batches", desc: `${gamesPerPlayer(2)} games / player` },
              { value: "3", label: "3 batches", desc: `${gamesPerPlayer(3)} games / player` },
            ]}
          />
        </FormRow>
        <div className="grid grid-cols-2 gap-3">
          <FormRow label="Courts">
            <Input type="number" min="1" value={courts}
              onChange={(e) => setCourts(e.target.value)} className={FIELD_H} />
          </FormRow>
          <FormRow label="Weeks">
            <Input type="number" min="1" value={weeks}
              onChange={(e) => setWeeks(e.target.value)} className={FIELD_H} />
          </FormRow>
        </div>
      </FormSection>

      <FormSection label="Start order">
        <FormRow label="Seed the first ladder by" hint="You can adjust positions before starting.">
          <SegmentedControl
            value={source}
            onChange={(v) => setSource(v as typeof source)}
            options={[
              { value: "pulse_rating", label: "Rating" },
              { value: "random", label: "Random" },
              { value: "manual", label: "Name" },
            ]}
          />
        </FormRow>
      </FormSection>

      <FormSection label="Automation">
        <label className="flex items-start justify-between gap-3 cursor-pointer">
          <div>
            <div className="text-sm font-semibold">Advance automatically</div>
            <p className="text-xs text-muted-foreground mt-0.5">
              When every game in a batch is in — and there's no tie to settle —
              process results and open the next batch of the week on their own,
              so play continues even if you're not there. Starting a new week
              always stays your call.
            </p>
          </div>
          <Switch checked={autoAdvance} onCheckedChange={setAutoAdvance} className="mt-0.5" />
        </label>
        <label className="flex items-start justify-between gap-3 cursor-pointer mt-3">
          <div>
            <div className="text-sm font-semibold">Players self-report scores</div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Any player on the court can enter the final score and it counts
              immediately — no second confirmation. Scores still can't be
              entered before the week's scheduled start time, so make sure the
              week's date and time are set correctly.
            </p>
          </div>
          <Switch checked={selfReport} onCheckedChange={setSelfReport} className="mt-0.5" />
        </label>
      </FormSection>

      <Button onClick={save} disabled={saving}
        className="w-full h-11 font-bold uppercase tracking-wide">
        {saving ? "Saving…" : "Save ladder settings"}
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Start — resolve the initial order and generate Week 1 / Batch 1    */
/* ------------------------------------------------------------------ */

function LadderStart({
  league, seasonId, ladder, onStarted,
}: {
  league: League;
  seasonId: string;
  ladder: ReturnType<typeof useLadder>;
  onStarted: () => void;
}) {
  const [order, setOrder] = useState<string[]>([]);
  const [starting, setStarting] = useState(false);
  const [weekPrompt, setWeekPrompt] = useState(false);
  const source = ladder.settings?.initial_order_source ?? "pulse_rating";

  useEffect(() => {
    (async () => {
      const ids = ladder.memberIds;
      if (!ids.length) { setOrder([]); return; }
      if (source === "pulse_rating") {
        const { data } = await supabase
          .from("profiles_public" as never)
          .select("id, current_rating").in("id", ids);
        const rating: Record<string, number> = {};
        (data ?? []).forEach((p) => {
          const r = p as { id: string; current_rating: number | null };
          rating[r.id] = r.current_rating ?? 0;
        });
        setOrder([...ids].sort((a, b) => (rating[b] ?? 0) - (rating[a] ?? 0)));
      } else if (source === "random") {
        const shuffled = [...ids];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        setOrder(shuffled);
      } else {
        setOrder([...ids].sort((a, b) => ladder.nameOf(a).localeCompare(ladder.nameOf(b))));
      }
    })();
    // eslint-disable-next-line
  }, [ladder.memberIds.join(","), source]);

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
  };

  const divisibleByFour = order.length > 0 && order.length % 4 === 0;

  const invokeStart = async (session_id: string | null) => {
    setStarting(true);
    const { data, error } = await supabase.functions.invoke("ladder-generate-first-batch", {
      body: { season_id: seasonId, order, session_id },
    });
    setStarting(false);
    if (error || (data as { error?: string })?.error) {
      toast.error((data as { message?: string })?.message ?? error?.message ?? "Couldn't start ladder");
      return;
    }
    toast.success("Ladder started — Week 1, Batch 1 generated");
    setWeekPrompt(false);
    onStarted();
  };

  const start = async () => {
    // Every batch must be assigned to a week (league_sessions row). Look for
    // an existing Week 1 session; if none exists, prompt the manager to
    // schedule one before we generate the first batch.
    const { data: existing } = await supabase
      .from("league_sessions" as never)
      .select("id")
      .eq("season_id", seasonId)
      .order("scheduled_date", { ascending: true, nullsFirst: false })
      .limit(1);
    const existingId = (existing?.[0] as { id?: string } | undefined)?.id;
    if (existingId) {
      await invokeStart(existingId);
    } else {
      setWeekPrompt(true);
    }
  };


  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 space-y-4">
      <div>
        <h3 className="text-sm font-bold">Set the starting ladder</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Positions 1–4 form Court 1, 5–8 Court 2, and so on. Reorder if needed,
          then start.
        </p>
      </div>

      {!divisibleByFour && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-300 flex gap-2">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            Ladder groups are foursomes, so the active roster must be divisible
            by four. You have <strong>{order.length}</strong> active player{order.length === 1 ? "" : "s"} —
            add or bench players on the Players tab so the count is a multiple of four.
          </span>
        </div>
      )}

      <ol className="space-y-1.5">
        {order.map((pid, i) => (
          <li key={pid}
            className={cn(
              "flex items-center gap-2 rounded-lg border border-border/60 bg-background/50 px-3 py-2",
              i % 4 === 0 && "mt-2 border-primary/30",
            )}
          >
            <span className="text-xs font-black tabular-nums w-6 text-center text-muted-foreground">
              {i + 1}
            </span>
            <span className="text-sm font-medium flex-1 truncate">{ladder.nameOf(pid)}</span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Court {Math.floor(i / 4) + 1}
            </span>
            <div className="flex items-center">
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">
                <ChevronUp className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                disabled={i === order.length - 1} onClick={() => move(i, 1)} aria-label="Move down">
                <ChevronDown className="w-4 h-4" />
              </Button>
            </div>
          </li>
        ))}
      </ol>

      <Button onClick={start} disabled={starting || !divisibleByFour}
        className="w-full h-11 font-bold uppercase tracking-wide">
        <Play className="w-4 h-4 mr-1.5" />
        {starting ? "Starting…" : "Start ladder"}
      </Button>

      {weekPrompt && (
        <WeekSessionDialog
          weekNumber={1}
          busy={starting}
          onCancel={() => setWeekPrompt(false)}
          onConfirm={async (details) => {
            const sid = await scheduleLadderWeek(league.id, seasonId, 1, details);
            if (!sid) return;
            await invokeStart(sid);
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Manage — current batch, scoring, finalize, order, movement, history */
/* ------------------------------------------------------------------ */

function LadderManage({
  league, ladder, onChanged,
}: {
  league: League;
  ladder: ReturnType<typeof useLadder>;
  onChanged: () => void;
}) {
  const { activeBatch, groups, games, settings } = ladder;
  const [processing, setProcessing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [pauseBusy, setPauseBusy] = useState(false);
  const [ties, setTies] = useState<TieInfo[] | null>(null);
  const [pendingTies, setPendingTies] = useState<TieInfo[]>([]);
  const paused = settings?.status === "paused";

  const togglePause = async () => {
    if (!settings) return;
    setPauseBusy(true);
    const { error } = await supabase.from("ladder_settings" as never)
      .update({ status: paused ? "active" : "paused" } as never)
      .eq("season_id", settings.season_id);
    setPauseBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(paused ? "Progression resumed" : "Progression paused");
    onChanged();
  };

  const gamesByGroup = useMemo(() => {
    const map = new Map<string, LadderGame[]>();
    groups.forEach((g) => {
      map.set(
        g.id,
        games.filter((m) => m.ladder_batch_group_id === g.id)
          .sort((a, b) => (a.ladder_game_number ?? 0) - (b.ladder_game_number ?? 0)),
      );
    });
    return map;
  }, [groups, games]);

  // "Counts toward the batch" must mirror the server: a valid, non-tied score
  // AND a status the process/finalize path accepts. A disputed (or otherwise
  // unverified) game keeps its scores but must NOT read as complete, or the
  // Process button lies and auto-advance stalls.
  const countable = (m: LadderGame) =>
    m.team_a_score != null && m.team_b_score != null && m.team_a_score !== m.team_b_score
    && (m.status === "verified" || m.status === "score_submitted");
  const totalGames = games.length;
  const scoredGames = games.filter(countable).length;
  const batchComplete = totalGames > 0 && scoredGames === totalGames;
  // Games with a score entered that still don't count (disputed / awaiting a
  // second confirmation) — surfaced so the organizer isn't left guessing.
  const stuckGames = games.filter(
    (m) => m.team_a_score != null && m.team_b_score != null && !countable(m),
  ).length;

  const processResults = async (tieResolutions?: Record<number, string[]>) => {
    if (!activeBatch) return;
    setProcessing(true);
    const { data, error } = await supabase.functions.invoke("ladder-finalize-batch", {
      body: { batch_id: activeBatch.id, tie_resolutions: tieResolutions },
    });
    setProcessing(false);
    const resp = data as
      { error?: string; message?: string; ties?: TieInfo[] } | null;
    // A tie that decides a move needs an organizer decision — open the prompt.
    if (resp?.error === "tiebreak_required" && resp.ties?.length) {
      setTies(resp.ties);
      // Persist pending tiebreaks so the player-side prompt can surface them
      // on tied courts. Idempotent — never clobbers rows players resolved.
      if (settings) {
        const rows = resp.ties
          .map((t) => {
            const g = groups[t.group_index];
            if (!g) return null;
            return {
              league_id: league.id,
              season_id: settings.season_id,
              batch_id: activeBatch.id,
              group_id: g.id,
              court_number: t.court_number,
              tied_player_ids: t.player_ids,
              boundaries: t.boundaries,
            };
          })
          .filter((r): r is NonNullable<typeof r> => r !== null);
        if (rows.length > 0) {
          await supabase.from("ladder_tiebreaks" as never).upsert(
            rows as never,
            { onConflict: "batch_id,group_id", ignoreDuplicates: true } as never,
          );
        }
      }
      setPendingTies(resp.ties);
      return;
    }
    if (error || resp?.error) {
      toast.error(resp?.message ?? error?.message ?? "Processing failed");
      return;
    }
    // Success — mark any lingering unresolved tiebreak rows for this batch
    // as resolved so both organizer and player prompts stand down.
    await supabase.from("ladder_tiebreaks" as never)
      .update({ resolved_at: new Date().toISOString() } as never)
      .eq("batch_id", activeBatch.id).is("resolved_at", null);
    setTies(null);
    setPendingTies([]);
    toast.success("Results processed — ladder updated. Generate the next stage when ready.");
    onChanged();
  };

  // Load persisted unresolved tiebreaks for the active batch so the banner
  // survives page reloads and shows up when auto-advance flagged the ties.
  const activeBatchId = activeBatch?.id;
  useEffect(() => {
    if (!activeBatchId) { setPendingTies([]); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("ladder_tiebreaks" as never)
        .select("group_id, court_number, tied_player_ids, boundaries, resolved_at")
        .eq("batch_id", activeBatchId)
        .is("resolved_at", null);
      if (cancelled) return;
      const rows = (data ?? []) as unknown as Array<{
        group_id: string; court_number: number | null;
        tied_player_ids: string[]; boundaries: ("promotion" | "relegation")[];
      }>;
      const infos: TieInfo[] = rows
        .map((r) => {
          const gi = groups.findIndex((g) => g.id === r.group_id);
          if (gi < 0) return null;
          return {
            group_index: gi,
            court_number: r.court_number ?? gi + 1,
            boundaries: r.boundaries,
            player_ids: r.tied_player_ids,
          } satisfies TieInfo;
        })
        .filter((x): x is TieInfo => x !== null);
      setPendingTies(infos);
    })();
    return () => { cancelled = true; };
  }, [activeBatchId, groups]);


  const batchesPerWeek = settings?.batches_per_week ?? 1;
  const totalWeeks = settings?.total_weeks ?? null;

  // What the organizer can generate NEXT — computed from the last PROCESSED
  // batch. Nothing is generated automatically; this only decides which
  // explicit button to offer once the current stage is fully processed.
  const nextStage = useMemo(() => {
    const last = ladder.lastFinalBatch;
    if (activeBatch || !last) return null;
    const lastW = last.week_number, lastB = last.batch_number;
    if (lastB < batchesPerWeek) {
      return { kind: "batch" as const, week: lastW, batch: lastB + 1,
        label: `Generate Batch ${lastB + 1}` };
    }
    if (totalWeeks == null || lastW < totalWeeks) {
      return { kind: "week" as const, week: lastW + 1, batch: 1,
        label: `Generate Week ${lastW + 1}` };
    }
    return { kind: "complete" as const, week: lastW, batch: lastB, label: "" };
  }, [ladder.lastFinalBatch, activeBatch, batchesPerWeek, totalWeeks]);

  const [weekPrompt, setWeekPrompt] = useState(false);
  // Week roster (sit-outs) validity — only meaningful when the next stage is
  // a new week. Defaults valid so batch generation is never blocked.
  const [weekRosterValid, setWeekRosterValid] = useState(true);
  const weekBlocked = nextStage?.kind === "week" && !weekRosterValid;

  const runGenerate = async (session_id?: string) => {
    if (!settings) return;
    setGenerating(true);
    const { data, error } = await supabase.functions.invoke("ladder-generate-next", {
      body: { season_id: settings.season_id, session_id: session_id ?? null },
    });
    setGenerating(false);
    if (error || (data as { error?: string })?.error) {
      toast.error((data as { message?: string })?.message ?? error?.message ?? "Generation failed");
      return;
    }
    const kind = (data as { kind?: string })?.kind;
    toast.success(kind === "week" ? "Next week generated" : "Next batch generated");
    // A sub was assigned but couldn't be seeded into the new batch (e.g. the
    // fill-in was double-booked). The week still generated — flag it so the
    // organizer can fix it with a manual swap instead of it failing silently.
    const seedErrors = (data as { sub_seed_errors?: string[] })?.sub_seed_errors;
    if (seedErrors && seedErrors.length > 0) {
      toast.warning(
        `${seedErrors.length} assigned sub${seedErrors.length === 1 ? "" : "s"} couldn't be placed — ` +
        "swap them in from the batch. " + seedErrors[0],
        { duration: 10000 },
      );
    }
    onChanged();
  };

  const generateNext = () => {
    if (!nextStage) return;
    // Starting a new week is only ever an explicit organizer action AND
    // requires confirming the date/time up front — scores can't be entered
    // before that moment (safeguard when self-report scoring is on).
    if (nextStage.kind === "week") {
      if (!weekRosterValid) {
        toast.error("Adjust the week roster so the number of players is a multiple of four.");
        return;
      }
      // Use the pre-scheduled session for this week if one exists; otherwise
      // prompt the organizer to schedule it (set its date) first.
      const scheduled = ladder.weekSessions.find((s) => s.week_number === nextStage.week);
      if (scheduled) { void runGenerate(scheduled.id); return; }
      setWeekPrompt(true);
      return;
    }
    void runGenerate();
  };

  // Auto-advance: when a batch is complete and tie-free, move on without the
  // organizer. Fires at most once per batch from this client; the edge
  // function is idempotent and re-checks every guard server-side.
  const autoAdvance = settings?.auto_advance ?? false;
  const seasonId = settings?.season_id;
  const advancedForRef = useRef<string | null>(null);
  useEffect(() => {
    if (!autoAdvance || paused || !seasonId) return;
    if (!activeBatch) return;
    // Reset the once-per-batch guard whenever the batch is NOT complete, so a
    // batch that later becomes complete again (e.g. after a disputed score is
    // corrected) re-triggers auto-advance instead of staying wedged.
    if (!batchComplete) { advancedForRef.current = null; return; }
    if (advancedForRef.current === activeBatch.id) return;
    advancedForRef.current = activeBatch.id;
    (async () => {
      const { data } = await supabase.functions.invoke("ladder-advance", {
        body: { season_id: seasonId },
      });
      const r = data as { advanced?: boolean; skipped?: string } | null;
      if (r?.advanced) {
        toast.success(
          r["week_complete" as keyof typeof r]
            ? "Week complete — generate the next week when you're ready"
            : "Batch complete — ladder advanced automatically",
        );
        onChanged();
      }
      // tiebreak_required / incomplete: leave it for a human; the Process
      // button + tiebreak dialog handle resolution.
    })().catch(() => { advancedForRef.current = null; });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAdvance, paused, seasonId, activeBatch?.id, batchComplete]);

  const toggleAuto = async () => {
    if (!settings) return;
    const { error } = await supabase.from("ladder_settings" as never)
      .update({ auto_advance: !autoAdvance } as never)
      .eq("season_id", settings.season_id);
    if (error) { toast.error(error.message); return; }
    toast.success(autoAdvance ? "Auto-advance turned off" : "Auto-advance turned on");
    onChanged();
  };

  const selfReport = (settings as unknown as { self_report_scoring?: boolean } | null)
    ?.self_report_scoring ?? false;
  const toggleSelfReport = async () => {
    if (!settings) return;
    const { error } = await supabase.from("ladder_settings" as never)
      .update({ self_report_scoring: !selfReport } as never)
      .eq("season_id", settings.season_id);
    if (error) { toast.error(error.message); return; }
    toast.success(selfReport ? "Self-report scoring off" : "Self-report scoring on");
    onChanged();
  };

  return (
    <div className="space-y-4">
      {/* Pending sub-requests badge — awareness even mid-week; resolve them
          in the Week roster when preparing that week. */}
      {ladder.pendingSubRequests > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2">
          <UserX className="w-4 h-4 shrink-0" />
          <span>
            {ladder.pendingSubRequests} sub request{ladder.pendingSubRequests === 1 ? "" : "s"} awaiting a decision.
            Resolve {ladder.pendingSubRequests === 1 ? "it" : "them"} in the Week roster when you prepare that week.
          </span>
        </div>
      )}

      {/* Progress header */}
      {activeBatch && (
        <div className="rounded-xl border border-border/70 bg-gradient-to-br from-[#0B171F] to-[#142029] p-4 text-white">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#A6DB5A]">
                Week {activeBatch.week_number}
                {settings?.total_weeks ? ` of ${settings.total_weeks}` : ""}
              </div>
              <div className="text-xl font-black">
                Batch {activeBatch.batch_number} of {batchesPerWeek}
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-black tabular-nums">
                {scoredGames}<span className="text-slate-500">/{totalGames}</span>
              </div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400">games in</div>
            </div>
          </div>
          <div className="mt-3 h-1.5 rounded-full bg-slate-700 overflow-hidden">
            <div className="h-full bg-[#A6DB5A] transition-all"
              style={{ width: `${totalGames ? (scoredGames / totalGames) * 100 : 0}%` }} />
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            {batchComplete
              ? "All games in — process results to apply movement. You'll then generate the next stage as a separate step."
              : "Enter every game's final score, then process the results to move players up and down."}
          </p>
          {stuckGames > 0 && !batchComplete && (
            <p className="text-[11px] text-amber-300 mt-1.5">
              {stuckGames} game{stuckGames === 1 ? " has" : "s have"} a score but
              {stuckGames === 1 ? " isn't" : " aren't"} counting yet — disputed, or
              still waiting on a second player to confirm. Resolve those to finish the batch.
            </p>
          )}
        </div>
      )}

      {/* Court groups + inline scoring */}
      {groups.map((g) => (
        <CourtGroupCard
          key={g.id}
          group={g}
          games={gamesByGroup.get(g.id) ?? []}
          scoring={settings?.scoring_format ?? "to_11_win_by_2"}
          nameOf={ladder.nameOf}
          onScored={onChanged}
        />
      ))}

      {paused && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-300 flex gap-2">
          <Pause className="w-4 h-4 shrink-0 mt-0.5" />
          <span>Progression is paused — processing and generation are disabled until you resume.</span>
        </div>
      )}

      {pendingTies.length > 0 && !ties && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 flex items-start gap-3">
          <Swords className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold">Tiebreaker needed</div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {pendingTies.length === 1 ? "One court" : `${pendingTies.length} courts`}{" "}
              ended level on record and points — Courts{" "}
              {pendingTies.map((t) => t.court_number).join(", ")}. Set the
              finishing order to move the ladder on. Players on those courts
              can also record it from their league page.
            </p>
          </div>
          <Button size="sm" onClick={() => setTies(pendingTies)}
            className="font-bold uppercase tracking-wide shrink-0">
            Resolve
          </Button>
        </div>
      )}


      {activeBatch && (
        <>
          <label className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/50 px-3 py-2 cursor-pointer">
            <div className="flex items-center gap-2 text-xs">
              <Zap className={cn("w-3.5 h-3.5", autoAdvance ? "text-[#A6DB5A]" : "text-muted-foreground")} />
              <span className="font-semibold">Auto-advance</span>
              <span className="text-muted-foreground">
                {autoAdvance
                  ? "on — batches move on themselves once scores are in"
                  : "off — you process and generate each batch"}
              </span>
            </div>
            <Switch checked={autoAdvance} onCheckedChange={toggleAuto} />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/50 px-3 py-2 cursor-pointer">
            <div className="flex items-center gap-2 text-xs">
              <CheckCircle2 className={cn("w-3.5 h-3.5", selfReport ? "text-[#A6DB5A]" : "text-muted-foreground")} />
              <span className="font-semibold">Self-report scoring</span>
              <span className="text-muted-foreground">
                {selfReport
                  ? "on — any player on the court can lock in the final score"
                  : "off — a second player must verify each score"}
              </span>
            </div>
            <Switch checked={selfReport} onCheckedChange={toggleSelfReport} />
          </label>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={togglePause} disabled={pauseBusy}
              className="h-12 shrink-0">
              {paused ? <Play className="w-4 h-4 mr-1.5" /> : <Pause className="w-4 h-4 mr-1.5" />}
              {paused ? "Resume" : "Pause"}
            </Button>
            <Button onClick={() => processResults()} disabled={processing || !batchComplete || paused}
              className="flex-1 h-12 font-bold uppercase tracking-wide">
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
              {processing ? "Processing…" : batchComplete ? "Process results" : `Process (${totalGames - scoredGames} left)`}
            </Button>
          </div>
        </>
      )}

      {ties && (
        <TiebreakDialog
          ties={ties}
          nameOf={ladder.nameOf}
          busy={processing}
          onCancel={() => setTies(null)}
          onResolve={(resolutions) => processResults(resolutions)}
        />
      )}

      {/* Sub requests — resolve any that the Week roster below isn't already
          covering (e.g. requests for weeks further out). */}
      {settings && (
        <SubRequestsPanel
          seasonId={settings.season_id}
          order={ladder.currentOrder}
          nameOf={ladder.nameOf}
          excludeWeek={!activeBatch && nextStage?.kind === "week" ? nextStage.week : null}
          version={ladder.version}
          disabled={paused}
          onChanged={onChanged}
        />
      )}

      {/* Week planner — pre-schedule the dated week shells players request
          subs against. Always available so organizers can plan ahead. */}
      {settings && (
        <WeekSchedulePanel
          league={league}
          seasonId={settings.season_id}
          ladder={ladder}
          totalWeeks={settings.total_weeks ?? null}
          onChanged={onChanged}
        />
      )}

      {/* Week roster — mark who's sitting out (no sub) before starting a new
          week. The playing count must stay a multiple of four. */}
      {!activeBatch && nextStage?.kind === "week" && settings && (
        <WeekRosterPanel
          leagueId={league.id}
          seasonId={settings.season_id}
          weekNumber={nextStage.week}
          sessionId={ladder.weekSessions.find((s) => s.week_number === nextStage.week)?.id ?? null}
          order={ladder.currentOrder}
          nameOf={ladder.nameOf}
          disabled={paused || generating}
          onValidChange={setWeekRosterValid}
          onMutated={onChanged}
        />
      )}

      {/* Explicit next-stage generation — only after the current stage is
          fully processed (no active batch). Never runs automatically. */}
      {!activeBatch && nextStage && (
        <GenerateNextPanel
          nextStage={nextStage}
          paused={paused}
          generating={generating}
          blocked={weekBlocked}
          onGenerate={generateNext}
        />
      )}

      {weekPrompt && nextStage?.kind === "week" && settings && (
        <WeekSessionDialog
          weekNumber={nextStage.week}
          busy={generating}
          onCancel={() => setWeekPrompt(false)}
          onConfirm={async (details) => {
            const sid = await scheduleLadderWeek(
              league.id, settings.season_id, nextStage.week, details);
            if (!sid) return;
            setWeekPrompt(false);
            await runGenerate(sid);
          }}
        />
      )}

      {/* Why each player finished where — last batch breakdown */}
      <LastBatchResults ladder={ladder} onChanged={onChanged} />

      {/* Current ladder + last movement */}
      <CurrentLadder ladder={ladder} />

      {/* History */}
      {ladder.history.length > 0 && (
        <div className="rounded-xl border border-border/70 bg-card p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
            Finalized batches
          </h3>
          <ul className="text-xs text-muted-foreground space-y-1">
            {ladder.history.map((b) => (
              <li key={b.id} className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                Week {b.week_number} · Batch {b.batch_number}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tiebreak — organizer decides who advances when scores are even     */
/* ------------------------------------------------------------------ */

interface TieInfo {
  group_index: number;
  court_number: number;
  boundaries: ("promotion" | "relegation")[];
  player_ids: string[];
}

function TiebreakDialog({
  ties, nameOf, busy, onCancel, onResolve,
}: {
  ties: TieInfo[];
  nameOf: (id: string) => string;
  busy: boolean;
  onCancel: () => void;
  onResolve: (resolutions: Record<number, string[]>) => void;
}) {
  // Per-court working order the organizer arranges (top = advances furthest).
  const [orders, setOrders] = useState<Record<number, string[]>>(() =>
    Object.fromEntries(ties.map((t) => [t.group_index, [...t.player_ids]])),
  );

  const move = (gi: number, i: number, dir: -1 | 1) => {
    setOrders((prev) => {
      const arr = [...(prev[gi] ?? [])];
      const j = i + dir;
      if (j < 0 || j >= arr.length) return prev;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return { ...prev, [gi]: arr };
    });
  };

  const label = (t: TieInfo) => {
    const both = t.boundaries.length > 1;
    if (both) return "tie affects both who moves up and who moves down";
    return t.boundaries[0] === "promotion"
      ? "tie for the court's top spot — the winner moves up"
      : "tie for last — the loser moves down";
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Who advances?</DialogTitle>
          <DialogDescription>
            {ties.length === 1 ? "A court" : `${ties.length} courts`} ended level
            on record and points. Play a tiebreaker (e.g. a skinny-singles game)
            and set the finishing order below — top of the list finishes highest.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-[55vh] overflow-y-auto">
          {ties.map((t) => {
            const promo = t.boundaries.includes("promotion");
            const relo = t.boundaries.includes("relegation");
            const arr = orders[t.group_index] ?? [];
            const movementFor = (i: number): "up" | "down" | "stay" => {
              if (i === 0 && promo) return "up";
              if (i === arr.length - 1 && relo) return "down";
              return "stay";
            };
            return (
            <div key={t.group_index} className="rounded-lg border border-border/70">
              <div className="px-3 py-2 bg-muted/40 border-b border-border/50">
                <div className="text-sm font-bold">Court {t.court_number}</div>
                <div className="text-[11px] text-muted-foreground">{label(t)}</div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 bg-muted/20 border-b border-border/50 text-[10px] text-muted-foreground">
                <span className="font-bold uppercase tracking-wide">Finishing order:</span>
                {promo && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide">
                    <ArrowUp className="w-3 h-3" strokeWidth={3} /> Up
                  </span>
                )}
                {promo && <span>top moves up a court</span>}
                {promo && relo && <span>·</span>}
                {relo && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/40 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide">
                    <ArrowDown className="w-3 h-3" strokeWidth={3} /> Down
                  </span>
                )}
                {relo && <span>bottom moves down a court</span>}
              </div>
              <ol className="divide-y divide-border/40">
                {arr.map((pid, i) => {
                  const kind = movementFor(i);
                  return (
                  <li key={pid} className="flex items-center gap-2 px-3 py-2">
                    <span className="text-xs font-black tabular-nums w-5 text-center text-muted-foreground">
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium flex-1 truncate">{nameOf(pid)}</span>
                    {kind === "up" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide">
                        <ArrowUp className="w-3 h-3" strokeWidth={3} /> Up
                      </span>
                    )}
                    {kind === "down" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/40 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide">
                        <ArrowDown className="w-3 h-3" strokeWidth={3} /> Down
                      </span>
                    )}
                    {kind === "stay" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted text-muted-foreground border border-border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide">
                        <Minus className="w-3 h-3" strokeWidth={3} /> Stay
                      </span>
                    )}
                    <div className="flex items-center">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                        disabled={i === 0 || busy}
                        onClick={() => move(t.group_index, i, -1)} aria-label="Move up">
                        <ChevronUp className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                        disabled={i === (orders[t.group_index]?.length ?? 0) - 1 || busy}
                        onClick={() => move(t.group_index, i, 1)} aria-label="Move down">
                        <ChevronDown className="w-4 h-4" />
                      </Button>
                    </div>
                  </li>
                  );
                })}
              </ol>
            </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button onClick={() => onResolve(orders)} disabled={busy}
            className="font-bold uppercase tracking-wide">
            {busy ? "Processing…" : "Confirm & process"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Week planner — pre-schedule the dated week shells players pick from */
/* ------------------------------------------------------------------ */

function WeekSchedulePanel({
  league, seasonId, ladder, totalWeeks, onChanged,
}: {
  league: League;
  seasonId: string;
  ladder: ReturnType<typeof useLadder>;
  totalWeeks: number | null;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [editWeek, setEditWeek] = useState<number | null>(null);
  const [removeWeek, setRemoveWeek] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const unschedule = async (week: number) => {
    setBusy(true);
    const { data, error } = await supabase.rpc("unschedule_ladder_week" as never, {
      p_season_id: seasonId, p_week_number: week,
    } as never);
    setBusy(false);
    setRemoveWeek(null);
    if (error) {
      toast.error((error as { message?: string }).message ?? "Couldn't remove the week");
      return;
    }
    const canceled = (data as { canceled_requests?: number } | null)?.canceled_requests ?? 0;
    toast.success(
      canceled > 0
        ? `Week ${week} removed — ${canceled} request${canceled === 1 ? "" : "s"} canceled`
        : `Week ${week} removed`,
    );
    onChanged();
  };

  const fmtDate = (d: string | null) =>
    d ? new Date(`${d}T00:00:00`).toLocaleDateString(undefined,
      { weekday: "short", month: "short", day: "numeric" }) : null;

  const generated = new Set<number>();
  ladder.history.forEach((b) => generated.add(b.week_number));
  if (ladder.activeBatch) generated.add(ladder.activeBatch.week_number);
  const currentWeek = generated.size ? Math.max(...generated) : 0;

  const byWeek = new Map(ladder.weekSessions.map((s) => [s.week_number, s]));
  const highestScheduled = ladder.weekSessions.reduce((m, s) => Math.max(m, s.week_number), 0);
  const horizon = Math.max(totalWeeks ?? 0, highestScheduled, currentWeek + 1);

  const upcoming: number[] = [];
  for (let w = currentWeek + 1; w <= horizon; w++) upcoming.push(w);
  const canAddMore = totalWeeks == null || horizon < totalWeeks;
  const scheduledCount = upcoming.filter((w) => byWeek.has(w)).length;

  const editing = editWeek != null ? byWeek.get(editWeek) : undefined;

  return (
    <div className="rounded-xl border border-border/70 bg-card overflow-hidden">
      <button type="button" onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 p-4 text-left">
        <div className="flex items-center gap-2 min-w-0">
          <CalendarClock className="w-4 h-4 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-bold">Week schedule</div>
            <div className="text-[11px] text-muted-foreground">
              {upcoming.length === 0
                ? "No upcoming weeks to schedule"
                : `${scheduledCount}/${upcoming.length} upcoming week${upcoming.length === 1 ? "" : "s"} scheduled`}
            </div>
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
              : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t border-border/60 divide-y divide-border/40">
          <div className="px-4 py-2.5 text-[11px] text-muted-foreground bg-muted/30">
            Pre-schedule upcoming weeks so players can request subs for them.
            Future weeks stay scheduled but aren't generated until the previous
            week is processed.
          </div>
          {upcoming.length === 0 && (
            <div className="p-4 text-xs text-muted-foreground">
              All weeks are complete.
            </div>
          )}
          {upcoming.map((w) => {
            const s = byWeek.get(w);
            const label = s ? fmtDate(s.scheduled_date) : null;
            return (
              <div key={w} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <div className="text-sm font-semibold">Week {w}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {s
                      ? (label ? `${label}${s.start_time ? ` · ${s.start_time.slice(0, 5)}` : ""}` : "Scheduled — no date set")
                      : "Not scheduled"}
                    {s?.location ? ` · ${s.location}` : ""}
                  </div>
                </div>
                {removeWeek === w ? (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[11px] text-muted-foreground">Remove?</span>
                    <Button size="sm" variant="destructive" disabled={busy}
                      onClick={() => unschedule(w)} className="h-8 text-xs">Yes</Button>
                    <Button size="sm" variant="ghost" disabled={busy}
                      onClick={() => setRemoveWeek(null)} className="h-8 text-xs">No</Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button size="sm" variant={s ? "outline" : "default"}
                      disabled={busy} onClick={() => setEditWeek(w)}
                      className="h-8 text-xs">
                      {s ? "Edit" : "Schedule"}
                    </Button>
                    {s && (
                      <Button size="sm" variant="ghost" disabled={busy}
                        onClick={() => setRemoveWeek(w)}
                        className="h-8 text-xs text-muted-foreground">
                        Remove
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {canAddMore && (
            <div className="px-4 py-2.5">
              <Button size="sm" variant="ghost" disabled={busy}
                onClick={() => setEditWeek(horizon + 1)}
                className="h-8 text-xs text-muted-foreground">
                + Schedule Week {horizon + 1}
              </Button>
            </div>
          )}
        </div>
      )}

      {editWeek != null && (
        <WeekSessionDialog
          weekNumber={editWeek}
          busy={busy}
          title={`Schedule Week ${editWeek}`}
          description="Set when this week is played. Players can request a sub for scheduled weeks; scores can't be entered before the start time."
          submitLabel={`Save Week ${editWeek}`}
          initial={editing ? {
            scheduled_date: editing.scheduled_date ?? "",
            start_time: editing.start_time ? editing.start_time.slice(0, 5) : "",
            end_time: editing.end_time ? editing.end_time.slice(0, 5) : "",
            location: editing.location ?? "",
            court_count: editing.court_count,
            capacity: editing.capacity,
          } : undefined}
          onCancel={() => setEditWeek(null)}
          onConfirm={async (details) => {
            setBusy(true);
            const sid = await scheduleLadderWeek(league.id, seasonId, editWeek, details);
            setBusy(false);
            if (!sid) return;
            setEditWeek(null);
            toast.success(`Week ${editWeek} scheduled`);
            onChanged();
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Week roster — sit players out when no sub can be found              */
/* ------------------------------------------------------------------ */

interface SubReqRow {
  id: string;
  player_id: string;
  note: string | null;
  status: "pending" | "sub" | "sitout" | "declined" | "canceled";
  assigned_sub_id: string | null;
  resolved_at?: string | null;
}

function WeekRosterPanel({
  leagueId, seasonId, weekNumber, sessionId, order, nameOf, disabled,
  onValidChange, onMutated,
}: {
  leagueId: string;
  seasonId: string;
  weekNumber: number;
  sessionId: string | null;
  order: string[];
  nameOf: (id: string) => string;
  disabled: boolean;
  onValidChange: (valid: boolean) => void;
  onMutated: () => void;
}) {
  const [sitouts, setSitouts] = useState<Set<string>>(new Set());
  const [requests, setRequests] = useState<SubReqRow[]>([]);
  const [candidates, setCandidates] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pickingReqId, setPickingReqId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((k) => k + 1);

  // Load this week's sit-outs, sub-requests, and eligible fill-ins.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const onLadder = new Set(order);
      const [sitRes, reqRes, memRes, subRes] = await Promise.all([
        supabase.from("ladder_week_sitouts" as never).select("player_id")
          .eq("season_id", seasonId).eq("week_number", weekNumber),
        sessionId
          ? supabase.from("ladder_sub_requests" as never)
              .select("id, player_id, note, status, assigned_sub_id")
              .eq("session_id", sessionId)
              .neq("status", "canceled")
          : Promise.resolve({ data: [] }),
        supabase.from("league_members" as never).select("user_id")
          .eq("season_id", seasonId).eq("status", "active"),
        supabase.from("league_substitutes" as never).select("user_id")
          .eq("season_id", seasonId).eq("status", "active"),
      ]);
      if (cancelled) return;

      const sitIds = ((sitRes.data ?? []) as Array<{ player_id: string }>).map((r) => r.player_id);
      setSitouts(new Set(sitIds.filter((id) => onLadder.has(id))));
      setRequests((reqRes.data ?? []) as unknown as SubReqRow[]);

      // Eligible fill-ins: active subs + active members not currently on the
      // ladder (players in the order are already playing this week).
      const memIds = ((memRes.data ?? []) as Array<{ user_id: string }>)
        .map((m) => m.user_id).filter((id) => !onLadder.has(id));
      const subIds = ((subRes.data ?? []) as Array<{ user_id: string }>).map((s) => s.user_id);
      const candIds = Array.from(new Set([...subIds, ...memIds]));
      if (candIds.length) {
        const { data: profs } = await supabase
          .from("profiles_public" as never)
          .select("id, display_name, full_name, first_name, last_name")
          .in("id", candIds);
        const nameById = new Map<string, string>(
          ((profs ?? []) as Array<{ id: string }>).map((p) => [p.id, resolvePlayerName(p as never)]),
        );
        setCandidates(candIds.map((id) => ({ id, name: nameById.get(id) ?? id.slice(0, 8) })));
      } else {
        setCandidates([]);
      }
      setLoading(false);
    })().catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seasonId, weekNumber, sessionId, order.length, reloadKey]);

  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const present = order.length - sitouts.size;
  const rem = present % 4;
  const valid = present > 0 && rem === 0 && pendingCount === 0;

  useEffect(() => { onValidChange(valid); }, [valid, onValidChange]);

  const toggle = async (pid: string) => {
    const sitting = !sitouts.has(pid);
    setBusyId(pid);
    const { error } = await supabase.rpc("set_ladder_week_sitout" as never, {
      p_season_id: seasonId,
      p_week_number: weekNumber,
      p_player_id: pid,
      p_sitting: sitting,
    } as never);
    setBusyId(null);
    if (error) {
      toast.error((error as { message?: string }).message ?? "Couldn't update the roster");
      return;
    }
    setSitouts((prev) => {
      const next = new Set(prev);
      if (sitting) next.add(pid); else next.delete(pid);
      return next;
    });
    onMutated();
  };

  const resolve = async (
    req: SubReqRow, resolution: "sub" | "sitout" | "declined", subId?: string,
  ) => {
    setBusyId(req.id);
    const { error } = await supabase.rpc("resolve_ladder_sub_request" as never, {
      p_request_id: req.id,
      p_resolution: resolution,
      p_assigned_sub_id: subId ?? null,
    } as never);
    setBusyId(null);
    if (error) {
      toast.error((error as { message?: string }).message ?? "Couldn't resolve the request");
      return;
    }
    setPickingReqId(null);
    reload();       // sit-out rows may have changed → refetch sitouts + requests
    onMutated();
  };

  // Subs from the pool may not be ladder players, so fall back to the
  // candidate names we loaded before the ladder name map.
  const candName = new Map(candidates.map((c) => [c.id, c.name]));
  const nameFor = (id: string) => candName.get(id) ?? nameOf(id);

  const sitMore = rem;          // sit this many more → present - rem
  const subCover = 4 - rem;     // cover this many with subs → present + (4-rem)

  return (
    <div className="rounded-xl border border-border/70 bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 p-4 text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Users className="w-4 h-4 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-bold flex items-center gap-2">
              Week {weekNumber} roster
              {pendingCount > 0 && (
                <span className="inline-flex items-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 text-[10px] font-bold">
                  {pendingCount} request{pendingCount === 1 ? "" : "s"}
                </span>
              )}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {pendingCount > 0
                ? `${pendingCount} sub request${pendingCount === 1 ? "" : "s"} to resolve`
                : sitouts.size === 0
                  ? "Everyone's in — tap to sit out anyone who can't make it"
                  : `${sitouts.size} sitting out this week`}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums",
              valid
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "bg-amber-500/10 text-amber-600 dark:text-amber-400",
            )}
          >
            {valid ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
            {present} playing
          </span>
          {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {pendingCount > 0 && (
        <div className="px-4 -mt-1 pb-3">
          <p className="text-[11px] text-amber-600 dark:text-amber-400 leading-relaxed">
            {pendingCount} sub request{pendingCount === 1 ? "" : "s"} need a decision before this week can be generated.
          </p>
        </div>
      )}
      {pendingCount === 0 && rem !== 0 && (
        <div className="px-4 -mt-1 pb-3">
          <p className="text-[11px] text-amber-600 dark:text-amber-400 leading-relaxed">
            Groups are foursomes, so the number playing must be a multiple of four.
            Sit out {sitMore} more {sitMore === 1 ? "player" : "players"} (→ {present - sitMore} playing),
            or bring {subCover} sitting {subCover === 1 ? "player" : "players"} back with a sub (→ {present + subCover} playing).
          </p>
        </div>
      )}

      {open && (
        <div className="border-t border-border/60 divide-y divide-border/40">
          {/* Sub requests players filed for this week */}
          {requests.length > 0 && (
            <div className="bg-muted/20">
              <div className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Sub requests
              </div>
              {requests.map((req) => {
                const resolvedLabel =
                  req.status === "sub"
                    ? `Sub: ${req.assigned_sub_id ? nameFor(req.assigned_sub_id) : "assigned"}`
                    : req.status === "sitout" ? "Sitting out"
                    : req.status === "declined" ? "Declined" : null;
                return (
                  <div key={req.id} className="px-4 py-2.5 border-t border-border/40 first:border-t-0">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <span className="text-sm font-medium">{nameFor(req.player_id)}</span>
                        {req.note && (
                          <span className="text-[11px] text-muted-foreground"> — “{req.note}”</span>
                        )}
                      </div>
                      {req.status !== "pending" && (
                        <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">
                          {resolvedLabel}
                        </span>
                      )}
                    </div>
                    {req.status === "pending" && pickingReqId !== req.id && (
                      <div className="flex items-center gap-1.5 mt-2">
                        <Button size="sm" variant="default" disabled={disabled || busyId === req.id}
                          onClick={() => setPickingReqId(req.id)} className="h-7 text-xs">
                          Find sub
                        </Button>
                        <Button size="sm" variant="outline" disabled={disabled || busyId === req.id || weekNumber < 2}
                          onClick={() => resolve(req, "sitout")} className="h-7 text-xs">
                          Sit out
                        </Button>
                        <Button size="sm" variant="ghost" disabled={disabled || busyId === req.id}
                          onClick={() => resolve(req, "declined")} className="h-7 text-xs text-muted-foreground">
                          Decline
                        </Button>
                      </div>
                    )}
                    {req.status === "pending" && pickingReqId === req.id && (
                      <div className="mt-2 space-y-1.5">
                        <div className="text-[11px] text-muted-foreground">Pick a fill-in:</div>
                        {candidates.length === 0 ? (
                          <div className="text-[11px] text-amber-600 dark:text-amber-400">
                            No eligible subs — add one in the Substitutes tab first.
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {candidates
                              .filter((c) => c.id !== req.player_id)
                              .map((c) => (
                                <Button key={c.id} size="sm" variant="outline"
                                  disabled={disabled || busyId === req.id}
                                  onClick={() => resolve(req, "sub", c.id)}
                                  className="h-7 text-xs">
                                  {c.name}
                                </Button>
                              ))}
                          </div>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => setPickingReqId(null)}
                          className="h-7 text-xs text-muted-foreground">Cancel</Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {loading ? (
            <div className="p-4 text-xs text-muted-foreground">Loading roster…</div>
          ) : order.length === 0 ? (
            <div className="p-4 text-xs text-muted-foreground">No players on the ladder yet.</div>
          ) : (
            order.map((pid, i) => {
              const sitting = sitouts.has(pid);
              return (
                <div key={pid} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[11px] font-bold text-muted-foreground tabular-nums w-6 shrink-0">
                      #{i + 1}
                    </span>
                    <span className={cn("text-sm truncate", sitting && "text-muted-foreground line-through")}>
                      {nameOf(pid)}
                    </span>
                    {sitting && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400 shrink-0">
                        <UserX className="w-3 h-3" /> Sitting out
                      </span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant={sitting ? "outline" : "ghost"}
                    disabled={disabled || busyId === pid}
                    onClick={() => toggle(pid)}
                    className="h-8 shrink-0 text-xs"
                  >
                    {busyId === pid ? "…" : sitting ? "Bring back" : "Sit out"}
                  </Button>
                </div>
              );
            })
          )}
          <div className="px-4 py-2.5 text-[11px] text-muted-foreground bg-muted/30">
            Sitting players keep their ladder position and return automatically next week.
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub requests — resolve requests for weeks not covered by the roster */
/* ------------------------------------------------------------------ */

interface SubReqWeekRow extends SubReqRow { week_number: number }

function SubRequestsPanel({
  seasonId, order, nameOf, excludeWeek, version, disabled, onChanged,
}: {
  seasonId: string;
  order: string[];
  nameOf: (id: string) => string;
  /** Week already handled by the Week roster panel — skip it here to avoid
   *  two places resolving the same request. Null when no roster is shown. */
  excludeWeek: number | null;
  version: number;
  disabled: boolean;
  onChanged: () => void;
}) {
  const [requests, setRequests] = useState<SubReqWeekRow[]>([]);
  const [candidates, setCandidates] = useState<Array<{ id: string; name: string }>>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pickingReqId, setPickingReqId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const onLadder = new Set(order);
      const [reqRes, memRes, subRes] = await Promise.all([
        supabase.from("ladder_sub_requests" as never)
          .select("id, player_id, note, status, assigned_sub_id, week_number, resolved_at")
          .eq("season_id", seasonId).neq("status", "canceled")
          .order("week_number", { ascending: true }),
        supabase.from("league_members" as never).select("user_id")
          .eq("season_id", seasonId).eq("status", "active"),
        supabase.from("league_substitutes" as never).select("user_id")
          .eq("season_id", seasonId).eq("status", "active"),
      ]);
      if (cancelled) return;
      const rows = ((reqRes.data ?? []) as unknown as SubReqWeekRow[])
        .filter((r) => excludeWeek == null || r.week_number !== excludeWeek);
      setRequests(rows);

      const memIds = ((memRes.data ?? []) as Array<{ user_id: string }>)
        .map((m) => m.user_id).filter((id) => !onLadder.has(id));
      const subIds = ((subRes.data ?? []) as Array<{ user_id: string }>).map((s) => s.user_id);
      const candIds = Array.from(new Set([...subIds, ...memIds]));
      if (candIds.length) {
        const { data: profs } = await supabase
          .from("profiles_public" as never)
          .select("id, display_name, full_name, first_name, last_name")
          .in("id", candIds);
        const nameById = new Map<string, string>(
          ((profs ?? []) as Array<{ id: string }>).map((p) => [p.id, resolvePlayerName(p as never)]),
        );
        setCandidates(candIds.map((id) => ({ id, name: nameById.get(id) ?? id.slice(0, 8) })));
      } else {
        setCandidates([]);
      }
    })().catch(() => { /* leave prior state on failure */ });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seasonId, excludeWeek, version, order.length]);

  const candName = new Map(candidates.map((c) => [c.id, c.name]));
  const nameFor = (id: string) => candName.get(id) ?? nameOf(id);

  const resolve = async (
    req: SubReqWeekRow, resolution: "sub" | "sitout" | "declined", subId?: string,
  ) => {
    setBusyId(req.id);
    const { error } = await supabase.rpc("resolve_ladder_sub_request" as never, {
      p_request_id: req.id,
      p_resolution: resolution,
      p_assigned_sub_id: subId ?? null,
    } as never);
    setBusyId(null);
    if (error) {
      toast.error((error as { message?: string }).message ?? "Couldn't resolve the request");
      return;
    }
    setPickingReqId(null);
    onChanged();
  };

  if (requests.length === 0) return null;
  const pending = requests.filter((r) => r.status === "pending").length;

  return (
    <div className="rounded-xl border border-border/70 bg-card overflow-hidden">
      <div className="flex items-center gap-2 p-4 border-b border-border/60">
        <UserX className="w-4 h-4 text-muted-foreground shrink-0" />
        <div className="text-sm font-bold">Sub requests</div>
        {pending > 0 && (
          <span className="inline-flex items-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 text-[10px] font-bold">
            {pending} pending
          </span>
        )}
      </div>
      <div className="divide-y divide-border/40">
        {requests.map((req) => {
          const resolvedLabel =
            req.status === "sub"
              ? `Sub: ${req.assigned_sub_id ? nameFor(req.assigned_sub_id) : "assigned"}`
              : req.status === "sitout" ? "Sitting out"
              : req.status === "declined" ? "Declined" : null;
          return (
            <div key={req.id} className="px-4 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-[11px] font-bold text-muted-foreground mr-1.5">Week {req.week_number}</span>
                  <span className="text-sm font-medium">{nameFor(req.player_id)}</span>
                  {req.note && (
                    <span className="text-[11px] text-muted-foreground"> — “{req.note}”</span>
                  )}
                </div>
                {req.status !== "pending" && (
                  <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 shrink-0 text-right">
                    {resolvedLabel}
                    {req.resolved_at && (
                      <span className="block font-normal text-muted-foreground">
                        {formatDistanceToNow(new Date(req.resolved_at), { addSuffix: true })}
                      </span>
                    )}
                  </span>
                )}
              </div>
              {req.status === "pending" && pickingReqId !== req.id && (
                <div className="flex items-center gap-1.5 mt-2">
                  <Button size="sm" variant="default" disabled={disabled || busyId === req.id}
                    onClick={() => setPickingReqId(req.id)} className="h-7 text-xs">Find sub</Button>
                  <Button size="sm" variant="outline" disabled={disabled || busyId === req.id || req.week_number < 2}
                    onClick={() => resolve(req, "sitout")} className="h-7 text-xs">Sit out</Button>
                  <Button size="sm" variant="ghost" disabled={disabled || busyId === req.id}
                    onClick={() => resolve(req, "declined")} className="h-7 text-xs text-muted-foreground">Decline</Button>
                </div>
              )}
              {req.status === "pending" && pickingReqId === req.id && (
                <div className="mt-2 space-y-1.5">
                  <div className="text-[11px] text-muted-foreground">Pick a fill-in:</div>
                  {candidates.length === 0 ? (
                    <div className="text-[11px] text-amber-600 dark:text-amber-400">
                      No eligible subs — add one in the Substitutes tab first.
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {candidates.filter((c) => c.id !== req.player_id).map((c) => (
                        <Button key={c.id} size="sm" variant="outline"
                          disabled={disabled || busyId === req.id}
                          onClick={() => resolve(req, "sub", c.id)} className="h-7 text-xs">
                          {c.name}
                        </Button>
                      ))}
                    </div>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setPickingReqId(null)}
                    className="h-7 text-xs text-muted-foreground">Cancel</Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GenerateNextPanel({
  nextStage, paused, generating, blocked = false, onGenerate,
}: {
  nextStage: { kind: "batch" | "week" | "complete"; week: number; batch: number; label: string };
  paused: boolean;
  generating: boolean;
  blocked?: boolean;
  onGenerate: () => void;
}) {
  if (nextStage.kind === "complete") {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-center">
        <Trophy className="w-6 h-6 mx-auto text-emerald-500 mb-1.5" />
        <div className="text-sm font-bold">Ladder complete</div>
        <p className="text-xs text-muted-foreground mt-0.5">
          Every week has been played and processed. Final standings are the
          current ladder below.
        </p>
      </div>
    );
  }

  const isWeek = nextStage.kind === "week";
  return (
    <div className="rounded-xl border border-border/70 bg-gradient-to-br from-[#0B171F] to-[#142029] p-4 text-white">
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#A6DB5A]">
        {isWeek ? "Week complete" : "Batch processed"}
      </div>
      <div className="text-lg font-black mt-0.5">
        {isWeek
          ? `Ready to start Week ${nextStage.week}`
          : `Ready for Batch ${nextStage.batch}`}
      </div>
      <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
        {isWeek
          ? "The week's final positions are locked in. Generating Week " +
            `${nextStage.week} builds new foursomes from the current ladder — ` +
            "no games are created until you do this."
          : `The ladder has been updated. Generate Batch ${nextStage.batch} to ` +
            "build the next round's foursomes from the current positions."}
      </p>
      <Button
        onClick={onGenerate}
        disabled={generating || paused || blocked}
        className="mt-3 w-full h-12 font-bold uppercase tracking-wide bg-[#A6DB5A] text-[#0B171F] hover:bg-[#95c94f]"
      >
        <Play className="w-4 h-4 mr-1.5" />
        {generating ? "Generating…" : nextStage.label}
      </Button>
      {blocked && !paused && (
        <p className="text-[11px] text-amber-300 mt-2">
          Adjust the week roster above so the number of players is a multiple of four.
        </p>
      )}
      {paused && (
        <p className="text-[11px] text-amber-300 mt-2">
          Progression is paused — resume to generate the next stage.
        </p>
      )}
    </div>
  );
}

interface WeekSessionDetails {
  scheduled_date: string;
  start_time: string;
  end_time: string;
  location: string;
  court_count: number | null;
  capacity: number | null;
}

function WeekSessionDialog({
  weekNumber, busy, submitLabel, title, description, initial, onCancel, onConfirm,
}: {
  weekNumber: number;
  busy: boolean;
  submitLabel?: string;
  title?: string;
  description?: string;
  initial?: Partial<WeekSessionDetails>;
  onCancel: () => void;
  onConfirm: (d: WeekSessionDetails) => void | Promise<void>;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(initial?.scheduled_date || today);
  const [start, setStart] = useState(initial?.start_time || "18:00");
  const [end, setEnd] = useState(initial?.end_time || "");
  const [loc, setLoc] = useState(initial?.location || "");
  const [courts, setCourts] = useState(
    initial?.court_count != null ? String(initial.court_count) : "");
  const [cap, setCap] = useState(
    initial?.capacity != null ? String(initial.capacity) : "");
  const canSubmit = !!date && !!start && !busy;

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title ?? `Schedule Week ${weekNumber}`}</DialogTitle>
          <DialogDescription>
            {description ??
              "Confirm when this week is played. Players can't enter scores " +
              "before this start time, so make sure it's right."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Date</div>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={FIELD_H} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Start time</div>
              <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} className={FIELD_H} />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">End time (optional)</div>
              <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className={FIELD_H} />
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Location (optional)</div>
            <Input value={loc} onChange={(e) => setLoc(e.target.value)}
              placeholder="e.g. Nickerson courts" className={FIELD_H} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Courts (optional)</div>
              <Input type="number" min="1" value={courts} onChange={(e) => setCourts(e.target.value)}
                placeholder="—" className={FIELD_H} />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Capacity (optional)</div>
              <Input type="number" min="0" value={cap} onChange={(e) => setCap(e.target.value)}
                placeholder="—" className={FIELD_H} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button
            disabled={!canSubmit}
            onClick={() => onConfirm({
              scheduled_date: date, start_time: start,
              end_time: end, location: loc,
              court_count: courts ? Number(courts) : null,
              capacity: cap ? Number(cap) : null,
            })}
            className="font-bold uppercase tracking-wide"
          >
            {busy ? "Saving…" : (submitLabel ?? `Generate Week ${weekNumber}`)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CourtGroupCard({
  group, games, scoring, nameOf, onScored,
}: {
  group: LadderGroup;
  games: LadderGame[];
  scoring: string;
  nameOf: (id: string) => string;
  onScored: () => void;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-muted/40 border-b border-border/50">
        <span className="text-sm font-bold">Court {group.court_number ?? group.group_index + 1}</span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {group.player_ids.map((p) => nameOf(p)).join(" · ")}
        </span>
      </div>
      <ul className="divide-y divide-border/50">
        {games.map((game) => (
          <GameScoreRow key={game.id} game={game} nameOf={nameOf} onScored={onScored} />
        ))}
      </ul>
      <div className="px-4 py-1.5 text-[10px] text-muted-foreground bg-muted/20">
        Format: {scoring.replace(/_/g, " ")}
      </div>
    </div>
  );
}

function GameScoreRow({
  game, nameOf, onScored,
}: {
  game: LadderGame;
  nameOf: (id: string) => string;
  onScored: () => void;
}) {
  const [a, setA] = useState(game.team_a_score?.toString() ?? "");
  const [b, setB] = useState(game.team_b_score?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const sideA = [game.player_a_id, game.player_b_id].filter(Boolean).map((id) => nameOf(id as string)).join(" & ");
  const sideB = [game.player_c_id, game.player_d_id].filter(Boolean).map((id) => nameOf(id as string)).join(" & ");
  const dirty = a !== (game.team_a_score?.toString() ?? "") || b !== (game.team_b_score?.toString() ?? "");
  const scored = game.team_a_score != null && game.team_b_score != null;

  const save = async () => {
    const na = Number(a), nb = Number(b);
    if (!a.trim() || !b.trim() || Number.isNaN(na) || Number.isNaN(nb) || na < 0 || nb < 0) {
      toast.error("Enter two non-negative scores"); return;
    }
    if (na === nb) { toast.error("Scores can't be tied"); return; }
    setSaving(true);
    const { error } = await supabase.from("league_matches" as never)
      .update({ team_a_score: na, team_b_score: nb, status: "verified" } as never)
      .eq("id", game.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    onScored();
  };

  return (
    <li className="px-4 py-2.5">
      <div className="flex items-center gap-2">
        <span className="text-xs flex-1 text-right truncate">{sideA || "—"}</span>
        <Input value={a} onChange={(e) => setA(e.target.value)} type="number" min="0"
          inputMode="numeric" className="h-9 w-12 text-center font-bold tabular-nums px-1" />
        <span className="text-muted-foreground text-xs">–</span>
        <Input value={b} onChange={(e) => setB(e.target.value)} type="number" min="0"
          inputMode="numeric" className="h-9 w-12 text-center font-bold tabular-nums px-1" />
        <span className="text-xs flex-1 truncate">{sideB || "—"}</span>
        <Button size="sm" variant={dirty ? "default" : "ghost"} className="h-8 shrink-0"
          disabled={saving || !dirty} onClick={save}>
          {scored && !dirty ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : "Save"}
        </Button>
      </div>
    </li>
  );
}

function CurrentLadder({ ladder }: { ladder: ReturnType<typeof useLadder> }) {
  const moveOf = useMemo(() => {
    const m: Record<string, "up" | "stay" | "down"> = {};
    ladder.lastMovements.forEach((mv) => { m[mv.player_id] = mv.direction; });
    return m;
  }, [ladder.lastMovements]);

  if (ladder.currentOrder.length === 0) return null;

  return (
    <div className="rounded-xl border border-border/70 bg-card p-4">
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
        <Trophy className="w-3.5 h-3.5" /> Current ladder
      </h3>
      <ol className="space-y-1">
        {ladder.currentOrder.map((pid, i) => {
          const dir = moveOf[pid];
          return (
            <li key={pid}
              className={cn(
                "flex items-center gap-2 rounded-lg px-2 py-1.5",
                i % 4 === 0 && "bg-muted/40",
              )}
            >
              <span className="text-xs font-black tabular-nums w-6 text-center text-muted-foreground">
                {i + 1}
              </span>
              <span className="text-sm font-medium flex-1 truncate">{ladder.nameOf(pid)}</span>
              {dir === "up" && <ArrowUp className="w-3.5 h-3.5 text-emerald-500" aria-label="Moved up" />}
              {dir === "down" && <ArrowDown className="w-3.5 h-3.5 text-destructive" aria-label="Moved down" />}
              {dir === "stay" && <Minus className="w-3.5 h-3.5 text-muted-foreground/50" aria-label="Stayed" />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function LastBatchResults({
  ladder, onChanged,
}: {
  ladder: ReturnType<typeof useLadder>;
  onChanged: () => void;
}) {
  const { lastFinalBatch, lastFinalGroups, lastMovements, nameOf } = ladder;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [forceOpen, setForceOpen] = useState(false);
  const [forceCount, setForceCount] = useState(0);
  const [busy, setBusy] = useState(false);

  const byGroup = useMemo(() => {
    const m = new Map<string, LadderMovementRow[]>();
    lastMovements.forEach((mv) => {
      const arr = m.get(mv.group_id) ?? [];
      arr.push(mv);
      m.set(mv.group_id, arr);
    });
    return m;
  }, [lastMovements]);

  const reopen = async (force: boolean) => {
    if (!lastFinalBatch) return;
    setBusy(true);
    const { data, error } = await (supabase.rpc as unknown as (
      fn: string, args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string; hint?: string } | null }>)(
      "ladder_reopen_batch",
      { p_batch_id: lastFinalBatch.id, p_force: force },
    );
    setBusy(false);
    if (error) {
      if (error.hint === "downstream_has_results") {
        // Extract the count from the message for the confirm copy.
        const n = Number(error.message.match(/\d+/)?.[0] ?? 0);
        setForceCount(n);
        setConfirmOpen(false);
        setForceOpen(true);
        return;
      }
      toast.error(error.message);
      return;
    }
    const removed = (data as { downstream_batches_removed?: number })?.downstream_batches_removed ?? 0;
    toast.success(
      removed > 0
        ? `Batch reopened — ${removed} downstream batch(es) cleared for regeneration`
        : "Batch reopened for correction",
    );
    setConfirmOpen(false);
    setForceOpen(false);
    onChanged();
  };

  if (!lastFinalBatch || lastMovements.length === 0) return null;

  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Last batch results · Week {lastFinalBatch.week_number} · Batch {lastFinalBatch.batch_number}
        </h3>
        <Button
          size="sm" variant="ghost"
          className="h-7 text-muted-foreground hover:text-foreground"
          onClick={() => setConfirmOpen(true)}
        >
          <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Reopen
        </Button>
      </div>

      {/* Confirm: reopen the last finalized batch */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reopen this batch to fix a score?</AlertDialogTitle>
            <AlertDialogDescription>
              This reopens Week {lastFinalBatch.week_number}, Batch{" "}
              {lastFinalBatch.batch_number} so you can correct a score, and clears
              any stage generated after it (it was based on the old ladder).
              You'll re-process the corrected batch, then generate the next stage
              again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); reopen(false); }} disabled={busy}>
              {busy ? "Reopening…" : "Reopen batch"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Force confirm: downstream already has played games */}
      <AlertDialog open={forceOpen} onOpenChange={setForceOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard {forceCount} already-played game(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              Batches generated after this one already have {forceCount} game(s)
              with entered scores. Reopening will permanently discard those
              results so the schedule can be regenerated from the correction.
              This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Keep them</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); reopen(true); }}
              disabled={busy}
              className="bg-destructive hover:bg-destructive/90"
            >
              {busy ? "Reopening…" : `Discard & reopen`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {lastFinalGroups.map((g) => {
        const rows = (byGroup.get(g.id) ?? [])
          .slice().sort((a, b) => a.finish_position - b.finish_position);
        if (rows.length === 0) return null;
        return (
          <div key={g.id} className="rounded-lg border border-border/60 overflow-hidden">
            <div className="px-3 py-1.5 bg-muted/40 text-xs font-bold">
              Court {g.court_number ?? g.group_index + 1}
            </div>
            <ul className="divide-y divide-border/40">
              {rows.map((r) => {
                const diff = r.points_for - r.points_against;
                return (
                  <li key={r.player_id} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                    <span className="w-5 text-center font-black tabular-nums text-muted-foreground">
                      {r.finish_position}
                    </span>
                    <span className="flex-1 truncate font-medium">{nameOf(r.player_id)}</span>
                    <span className="tabular-nums text-xs text-muted-foreground">
                      {r.wins}–{r.losses}
                    </span>
                    <span className={cn(
                      "tabular-nums text-xs w-10 text-right font-mono",
                      diff > 0 && "text-emerald-600", diff < 0 && "text-destructive",
                      diff === 0 && "text-muted-foreground",
                    )}>
                      {diff > 0 ? "+" : ""}{diff}
                    </span>
                    {r.direction === "up" && <ArrowUp className="w-3.5 h-3.5 text-emerald-500" />}
                    {r.direction === "down" && <ArrowDown className="w-3.5 h-3.5 text-destructive" />}
                    {r.direction === "stay" && (
                      <Minus className="w-3.5 h-3.5 text-muted-foreground/50" />
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Inline explainer                                                   */
/* ------------------------------------------------------------------ */

function LadderExplainerInline() {
  return (
    <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-3 text-xs text-violet-700 dark:text-violet-300 space-y-1.5">
      <div className="font-bold flex items-center gap-1.5">
        <Layers className="w-3.5 h-3.5" /> How the individual doubles ladder works
      </div>
      <p className="leading-relaxed">
        Players are ranked individually. Each week they're grouped into
        foursomes by ladder position (1–4 = Court 1, 5–8 = Court 2…). In each
        group everyone plays three games, partnering all three others once —
        so you compete as an individual, not a fixed team. After every game in
        a batch is scored, results are tallied: the group winner moves up a
        court, 4th moves down, and the ladder re-sorts for the next batch.
      </p>
    </div>
  );
}
