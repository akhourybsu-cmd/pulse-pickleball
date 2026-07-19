import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Layers, Trophy, ArrowUp, ArrowDown, Minus, Info, Play, Pause, CheckCircle2,
  ChevronUp, ChevronDown,
} from "lucide-react";
import type { League, LeagueSeason } from "@/lib/leagues/types";
import { gamesPerPlayer } from "@/lib/leagues/ladder";
import {
  useLadder, type LadderGame, type LadderGroup, type LadderMovementRow,
} from "@/hooks/useLadder";
import { cn } from "@/lib/utils";
import {
  EmptyState, TabSkeleton, LeagueTabProps, FormSection, FormRow, FIELD_H,
  SeasonSelect, ChoiceGrid, SegmentedControl,
} from "./_shared";

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

  const start = async () => {
    setStarting(true);
    const { data, error } = await supabase.functions.invoke("ladder-generate-first-batch", {
      body: { season_id: seasonId, order },
    });
    setStarting(false);
    if (error || (data as { error?: string })?.error) {
      toast.error((data as { message?: string })?.message ?? error?.message ?? "Couldn't start ladder");
      return;
    }
    toast.success("Ladder started — Week 1, Batch 1 generated");
    onStarted();
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
  const [finalizing, setFinalizing] = useState(false);
  const [pauseBusy, setPauseBusy] = useState(false);
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

  const totalGames = games.length;
  const scoredGames = games.filter(
    (m) => m.team_a_score != null && m.team_b_score != null && m.team_a_score !== m.team_b_score,
  ).length;
  const batchComplete = totalGames > 0 && scoredGames === totalGames;

  const finalize = async () => {
    if (!activeBatch) return;
    setFinalizing(true);
    const { data, error } = await supabase.functions.invoke("ladder-finalize-batch", {
      body: { batch_id: activeBatch.id },
    });
    setFinalizing(false);
    if (error || (data as { error?: string })?.error) {
      toast.error((data as { message?: string })?.message ?? error?.message ?? "Finalize failed");
      return;
    }
    toast.success("Batch finalized — ladder updated");
    onChanged();
  };

  const batchesPerWeek = settings?.batches_per_week ?? 1;

  return (
    <div className="space-y-4">
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
              ? "All games in — finalize to apply movement and generate the next batch."
              : "Court assignments update after every game in this batch is finalized."}
          </p>
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
          <span>Progression is paused — finalizing is disabled until you resume.</span>
        </div>
      )}

      {activeBatch && (
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={togglePause} disabled={pauseBusy}
            className="h-12 shrink-0">
            {paused ? <Play className="w-4 h-4 mr-1.5" /> : <Pause className="w-4 h-4 mr-1.5" />}
            {paused ? "Resume" : "Pause"}
          </Button>
          <Button onClick={finalize} disabled={finalizing || !batchComplete || paused}
            className="flex-1 h-12 font-bold uppercase tracking-wide">
            <CheckCircle2 className="w-4 h-4 mr-1.5" />
            {finalizing ? "Finalizing…" : batchComplete ? "Finalize batch" : `Finalize (${totalGames - scoredGames} left)`}
          </Button>
        </div>
      )}

      {/* Why each player finished where — last batch breakdown */}
      <LastBatchResults ladder={ladder} />

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

function LastBatchResults({ ladder }: { ladder: ReturnType<typeof useLadder> }) {
  const { lastFinalBatch, lastFinalGroups, lastMovements, nameOf } = ladder;
  const byGroup = useMemo(() => {
    const m = new Map<string, LadderMovementRow[]>();
    lastMovements.forEach((mv) => {
      const arr = m.get(mv.group_id) ?? [];
      arr.push(mv);
      m.set(mv.group_id, arr);
    });
    return m;
  }, [lastMovements]);

  if (!lastFinalBatch || lastMovements.length === 0) return null;

  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 space-y-3">
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
        Last batch results · Week {lastFinalBatch.week_number} · Batch {lastFinalBatch.batch_number}
      </h3>
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
