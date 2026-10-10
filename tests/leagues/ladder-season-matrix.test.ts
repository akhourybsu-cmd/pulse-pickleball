import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { writeFileSync } from "node:fs";
import type { PGlite } from "@electric-sql/pglite";
import { leagueActor, leagueSimulationDatabase } from "../helpers/leagueSimulationDatabase";
import { leagueEdgeHandler, leagueSimulationClient } from "../helpers/leagueSimulationClient";
import { computePlayerStandings } from "@/lib/leagues/standings";
import type { LeagueMatch } from "@/lib/leagues/types";

// Full, isolated league seasons. Production SQL, RLS, triggers and unchanged
// edge handlers run against PGlite. Identity/HTTP and global rating math are
// isolated by the shared harness; these tests verify the rating input bridge.
type Scenario = { name: string; players: number; courts: number; weeks: number; batches: number;
  scoring: "confirmed" | "self" | "manager"; auto?: boolean; ties?: boolean;
  action?: "subs" | "sitouts" | "replace" | "correct" | "schedule-gate" | "pending-gate"; unranked?: boolean };
const scenarios: Scenario[] = [
  { name: "Four-player ladder with opponent confirmation", players: 4, courts: 1, weeks: 3, batches: 1, scoring: "confirmed" },
  { name: "Unranked eight-player league on one court", players: 8, courts: 1, weeks: 3, batches: 2, scoring: "manager", unranked: true },
  { name: "Automatic progression waits for the next week schedule", players: 12, courts: 2, weeks: 3, batches: 2, scoring: "self", auto: true, action: "schedule-gate" },
  { name: "Organizer resolves movement-deciding ties", players: 16, courts: 2, weeks: 3, batches: 2, scoring: "manager", ties: true },
  { name: "Automatic ties and unresolved substitute requests", players: 20, courts: 3, weeks: 3, batches: 2, scoring: "self", auto: true, ties: true, action: "pending-gate" },
  { name: "Substitute covers every batch and returns the regular next week", players: 16, courts: 2, weeks: 3, batches: 2, scoring: "confirmed", action: "subs" },
  { name: "Four sit-outs retain their rungs and return next week", players: 20, courts: 2, weeks: 3, batches: 2, scoring: "confirmed", action: "sitouts" },
  { name: "Permanent replacement between completed weeks", players: 12, courts: 1, weeks: 3, batches: 2, scoring: "manager", action: "replace" },
  { name: "Reopen, correct and regenerate downstream games", players: 24, courts: 3, weeks: 3, batches: 2, scoring: "confirmed", action: "correct" },
  { name: "Thirty-two players, four weeks and three batches per week", players: 32, courts: 3, weeks: 4, batches: 3, scoring: "confirmed" },
];
type Game = LeagueMatch & { ladder_game_number: number; ladder_batch_group_id: string; linked_match_id: string | null };
type Batch = { id: string; status: string; start_snapshot_id: string; result_snapshot_id: string | null; week_number: number; batch_number: number };
type Group = { id: string; group_index: number; court_number: number; wave: number; player_ids: string[] };
type Recorded = { slots: string[]; a: number; b: number };
type Result = { number: number; name: string; players: number; courts: number; weeks: number; batches: number;
  seasonId: string; status: string; games: number; playerResults: number; ratingInputs: number; retries: number;
  rejectedActions: number; tieDecisions: number; durationMs: number; error?: string };
let db: PGlite;
let first: Awaited<ReturnType<typeof leagueEdgeHandler>>, next: typeof first, finalize: typeof first, advance: typeof first;
const results: Result[] = [];
const archived = new Map<string, string>();
let finalReconciliation = "not_run";
const firstDay = Date.parse("2027-01-04T19:00:00Z");
const setWeek = (week: number) => vi.setSystemTime(new Date(firstDay + (week - 1) * 7 * 86400000));
const id = (n: number) => `9b000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const rows = async <T>(sql: string, params: unknown[] = []): Promise<T[]> =>
  JSON.parse(JSON.stringify((await db.query<T>(sql, params)).rows));
const slots = (game: Game) => [game.player_a_id!, game.player_b_id!, game.player_c_id!, game.player_d_id!];
async function rpc<T = Record<string, unknown>>(user: string, name: string, args: Record<string, unknown>): Promise<T> {
  const response = await leagueSimulationClient(db, user).rpc(name, args);
  if (response.error) throw new Error(response.error.message);
  return response.data as T;
}
const games = (batch: string) => rows<Game>(
  "SELECT m.* FROM league_matches m JOIN ladder_batch_groups g ON g.id=m.ladder_batch_group_id WHERE g.batch_id=$1 ORDER BY g.group_index,m.ladder_game_number", [batch]);
// Capture persisted league state, including rating input rows, to prove rejected
// operations and retries cannot partially modify this or earlier seasons.
async function snapshot(season: string) {
  const data = [];
  for (const table of ["league_matches", "ladder_batches", "ladder_snapshots", "league_members", "league_audit_log", "ladder_tiebreaks", "ladder_settings"])
    data.push(await rows(`SELECT * FROM ${table} WHERE season_id=$1 ORDER BY id`, [season]));
  data.push(await rows("SELECT * FROM league_seasons WHERE id=$1", [season]));
  data.push(await rows("SELECT m.* FROM ladder_movements m JOIN ladder_batches b ON b.id=m.batch_id WHERE b.season_id=$1 ORDER BY m.id", [season]));
  data.push(await rows("SELECT mm.* FROM matches mm JOIN league_matches lm ON lm.linked_match_id=mm.id WHERE lm.season_id=$1 ORDER BY mm.id", [season]));
  data.push(await rows("SELECT mp.* FROM match_participants mp JOIN league_matches lm ON lm.linked_match_id=mp.match_id WHERE lm.season_id=$1 ORDER BY mp.id", [season]));
  return JSON.stringify(data);
}

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ["Date"] }); setWeek(1);
  db = await leagueSimulationDatabase();
  [first, next, finalize, advance] = await Promise.all([
    "ladder-generate-first-batch", "ladder-generate-next", "ladder-finalize-batch", "ladder-advance",
  ].map(name => leagueEdgeHandler(db, name)));
}, 60_000);
afterAll(async () => {
  await db?.close(); vi.useRealTimers();
  const totals = { leagues: results.length, passed: results.filter(r => r.status === "passed").length,
    games: results.reduce((n, r) => n + r.games, 0), playerResults: results.reduce((n, r) => n + r.playerResults, 0),
    ratingInputs: results.reduce((n, r) => n + r.ratingInputs, 0), retries: results.reduce((n, r) => n + r.retries, 0),
    rejectedActions: results.reduce((n, r) => n + r.rejectedActions, 0), tieDecisions: results.reduce((n, r) => n + r.tieDecisions, 0) };
  const report = { generatedAt: new Date().toISOString(), expectedLeagues: scenarios.length, finalReconciliation,
    environment: "Isolated PGlite with production league migrations, RLS, triggers and edge handlers. HTTP/auth transport and global rating calculations are isolated; no live records, network concurrency, realtime delivery or mobile UI tested.",
    totals, scenarios: results };
  if (process.env.LADDER_SEASON_REPORT) writeFileSync(process.env.LADDER_SEASON_REPORT, JSON.stringify(report, null, 2) + "\n");
  console.info("LADDER_SEASON_TOTALS", JSON.stringify(totals));
});

it.each(scenarios.map((scenario, index) => ({ ...scenario, number: index + 1 })))("league $number: $name", async scenario => {
  const began = performance.now(); setWeek(1);
  const base = scenario.number * 1000, owner = id(base), manager = id(base + 1), outsider = id(base + 2);
  const sub = id(base + 3), replacement = id(base + 4);
  const roster = Array.from({ length: scenario.players }, (_, i) => id(base + 100 + i));
  const result: Result = { number: scenario.number, name: scenario.name, players: scenario.players, courts: scenario.courts,
    weeks: scenario.weeks, batches: scenario.weeks * scenario.batches, seasonId: "", status: "running",
    games: 0, playerResults: 0, ratingInputs: 0, retries: 0, rejectedActions: 0, tieDecisions: 0, durationMs: 0 };
  results.push(result);
  const act = leagueActor(db, manager);
  const ledger = new Map<string, Recorded>();
  let season = "", league = "";
  const sessions: string[] = [];
  let pendingRequest = "";
  async function rejectUnchanged(work: () => Promise<unknown>, message: RegExp) {
    const before = await snapshot(season);
    await expect(work()).rejects.toThrow(message);
    expect(await snapshot(season)).toBe(before); result.rejectedActions++;
  }
  async function blocked(work: () => Promise<{ body: Record<string, unknown> }>, key: string, value: string) {
    const before = await snapshot(season);
    expect((await work()).body[key]).toBe(value);
    expect(await snapshot(season)).toBe(before); result.rejectedActions++;
  }
  async function schedule(week: number) {
    const response = await rpc<{ session_id: string }>(manager, "schedule_ladder_week", {
      p_league_id: league, p_season_id: season, p_week_number: week,
      p_scheduled_date: new Date(firstDay + (week - 1) * 7 * 86400000).toISOString().slice(0, 10),
      p_start_time: "18:00", p_end_time: "23:00", p_court_count: scenario.courts, p_capacity: scenario.players,
    });
    sessions[week - 1] = response.session_id;
  }
  const submit = (game: Game, a: number, b: number, user: string) => rpc(user, "submit_league_match_score", {
    p_match_id: game.id, p_team_a_score: a, p_team_b_score: b,
  });
  const confirm = (game: Game, a: number, b: number, user = game.player_c_id!) => rpc(user, "confirm_league_match_score", {
    p_match_id: game.id, p_team_a_score: a, p_team_b_score: b,
  });
  async function reconcile() {
    const saved = await rows<Game>("SELECT * FROM league_matches WHERE season_id=$1 AND status='verified' ORDER BY id", [season]);
    expect(saved).toHaveLength(ledger.size);
    const bridge = await rows<{ id: string; team1_score: number; team2_score: number; count_for_rating: boolean; voided: boolean; status: string }>(
      "SELECT mm.* FROM matches mm JOIN league_matches lm ON lm.linked_match_id=mm.id WHERE lm.season_id=$1 ORDER BY mm.id", [season]);
    const participants = await rows<{ match_id: string; player_id: string; team: number }>(
      "SELECT mp.* FROM match_participants mp JOIN league_matches lm ON lm.linked_match_id=mp.match_id WHERE lm.season_id=$1", [season]);
    expect(bridge).toHaveLength(scenario.unranked ? 0 : saved.length);
    expect(participants).toHaveLength(bridge.length * 4);
    const expectedStats = new Map<string, { gamesPlayed: number; wins: number; losses: number; pointsFor: number; pointsAgainst: number; pointDiff: number }>();
    for (const game of saved) {
      const expected = ledger.get(game.id)!;
      expect(game).toMatchObject({ team_a_score: expected.a, team_b_score: expected.b });
      expect(slots(game)).toEqual(expected.slots);
      if (scenario.unranked) expect(game.linked_match_id).toBeNull();
      else {
        expect(bridge.find(b => b.id === game.linked_match_id)).toMatchObject({ team1_score: expected.a, team2_score: expected.b,
          count_for_rating: true, voided: false, status: "approved" });
        expect(participants.filter(p => p.match_id === game.linked_match_id).map(p => `${p.team}:${p.player_id}`).sort())
          .toEqual(expected.slots.map((p, index) => `${index < 2 ? 1 : 2}:${p}`).sort());
      }
      expected.slots.forEach((player, index) => {
        const pf = index < 2 ? expected.a : expected.b, pa = index < 2 ? expected.b : expected.a;
        const stats = expectedStats.get(player) ?? { gamesPlayed: 0, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, pointDiff: 0 };
        stats.gamesPlayed++; stats.wins += Number(pf > pa); stats.losses += Number(pf < pa);
        stats.pointsFor += pf; stats.pointsAgainst += pa; stats.pointDiff += pf - pa; expectedStats.set(player, stats);
      });
    }
    const standings = computePlayerStandings(saved, user => user, { seasonId: season });
    expect(standings).toHaveLength(expectedStats.size);
    for (const standing of standings) expect(standing).toMatchObject(expectedStats.get(standing.teamId)!);
    expect(standings.reduce((sum, row) => sum + row.pointDiff, 0)).toBe(0);
    result.games = ledger.size; result.playerResults = ledger.size * 4; result.ratingInputs = bridge.length;
  }
  // Independent arithmetic and movement oracle: do not call the production
  // ranking engine to calculate its own expected result. These complete 3-game
  // rotations give an exact-stat pair an even head-to-head record.
  async function verifyMovement(batch: Batch, groups: Group[], resolutions: Record<number, string[]>) {
    const before = (await rows<{ player_ids: string[] }>("SELECT player_ids FROM ladder_snapshots WHERE id=$1", [batch.start_snapshot_id]))[0].player_ids;
    const substitutions = await rows<{ match_id: string; in_player_id: string; out_player_id: string }>(
      "SELECT s.* FROM league_match_substitutions s JOIN league_matches m ON m.id=s.match_id JOIN ladder_batch_groups g ON g.id=m.ladder_batch_group_id WHERE g.batch_id=$1", [batch.id]);
    const movements = await rows<{ player_id: string; group_id: string; start_position: number; finish_position: number; direction: string; capped: string | null;
      wins: number; losses: number; points_for: number; points_against: number }>("SELECT * FROM ladder_movements WHERE batch_id=$1", [batch.id]);
    const draw = await games(batch.id), destination: string[] = [];
    expect(movements).toHaveLength(groups.length * 4);
    for (const group of groups) {
      const stats = group.player_ids.map((player, start) => ({ player, start, wins: 0, losses: 0, pf: 0, pa: 0 }));
      for (const game of draw.filter(g => g.ladder_batch_group_id === group.id)) {
        const record = ledger.get(game.id)!;
        record.slots.forEach((actual, index) => {
          const identity = substitutions.find(s => s.match_id === game.id && s.in_player_id === actual)?.out_player_id ?? actual;
          const stat = stats.find(s => s.player === identity)!;
          const pf = index < 2 ? record.a : record.b, pa = index < 2 ? record.b : record.a;
          stat.wins += Number(pf > pa); stat.losses += Number(pf < pa); stat.pf += pf; stat.pa += pa;
        });
      }
      const resolution = resolutions[group.group_index] ?? [];
      const priority = (player: string) => resolution.includes(player) ? resolution.indexOf(player) : 99;
      stats.sort((a, b) => b.wins - a.wins || (b.pf - b.pa) - (a.pf - a.pa) || b.pf - a.pf || priority(a.player) - priority(b.player) || a.start - b.start);
      stats.forEach((stat, rank) => {
        const gi = group.group_index, last = groups.length - 1;
        const target = rank === 0 ? Math.max(0, gi - 1) : rank === 3 ? Math.min(last, gi + 1) : gi;
        const slot = rank === 0 && gi > 0 ? 3 : rank === 3 && gi < last ? 0 : rank;
        destination[target * 4 + slot] = stat.player;
        expect(movements.find(m => m.player_id === stat.player)).toMatchObject({ group_id: group.id,
          start_position: stat.start, finish_position: rank + 1, wins: stat.wins, losses: stat.losses,
          points_for: stat.pf, points_against: stat.pa,
          direction: target < gi ? "up" : target > gi ? "down" : "stay",
          capped: rank === 0 && gi === 0 ? "top" : rank === 3 && gi === last ? "bottom" : null });
      });
    }
    const sitting = new Set(scenario.action === "sitouts" && batch.week_number === 2 ? roster.slice(4, 8) : []);
    let cursor = 0;
    const expectedOrder = before.map(player => sitting.has(player) ? player : destination[cursor++]);
    const after = (await rows<{ player_ids: string[] }>(
      "SELECT s.player_ids FROM ladder_snapshots s JOIN ladder_batches b ON b.result_snapshot_id=s.id WHERE b.id=$1", [batch.id]))[0].player_ids;
    expect(after).toEqual(expectedOrder); expect(new Set(after).size).toBe(scenario.players);
    expect([...after].sort()).toEqual([...before].sort());
  }
  async function process(batch: Batch, groups: Group[]) {
    const resolutions: Record<number, string[]> = {};
    if (scenario.auto) {
      let response = await advance(roster[0], { season_id: season });
      if (scenario.ties) {
        expect(response.body.skipped).toBe("tiebreak_required");
        const ties = await rows<{ group_id: string; tied_player_ids: string[] }>("SELECT * FROM ladder_tiebreaks WHERE batch_id=$1", [batch.id]);
        expect(ties.length).toBeGreaterThan(0);
        for (const tie of ties) {
          const order = [...tie.tied_player_ids].reverse();
          await rejectUnchanged(() => rpc(outsider, "record_ladder_tiebreak", { p_group_id: tie.group_id, p_ordered_ids: order }), /Only players on this court/i);
          await rpc(manager, "record_ladder_tiebreak", { p_group_id: tie.group_id, p_ordered_ids: order });
          resolutions[groups.find(g => g.id === tie.group_id)!.group_index] = order; result.tieDecisions++;
        }
        response = await advance(roster[0], { season_id: season });
      }
      expect(response.body, JSON.stringify(response)).toMatchObject({ advanced: true });
      expect(response.body.sub_seed_errors).toBeUndefined();
      if (batch.week_number === 1 && batch.batch_number === scenario.batches && scenario.action === "schedule-gate") {
        expect(response.body.awaiting_week_schedule).toBe(2);
        expect(await rows("SELECT id FROM ladder_batches WHERE season_id=$1 AND week_number=2", [season])).toHaveLength(0);
        await schedule(2);
        expect((await advance(roster[0], { season_id: season })).body.generated).toEqual({ week: 2, batch: 1 });
      }
      if (batch.week_number === 1 && batch.batch_number === scenario.batches && scenario.action === "pending-gate") {
        expect(response.body.awaiting_sub_resolution).toBe(1);
        expect(await rows("SELECT id FROM ladder_batches WHERE season_id=$1 AND week_number=2", [season])).toHaveLength(0);
        await rpc(roster[0], "cancel_ladder_sub_request", { p_request_id: pendingRequest });
        expect((await advance(roster[0], { season_id: season })).body.generated).toEqual({ week: 2, batch: 1 });
      }
    } else {
      let response = await finalize(manager, { batch_id: batch.id });
      if (scenario.ties) {
        expect(response.body.error).toBe("tiebreak_required");
        for (const tie of response.body.ties as { group_index: number; player_ids: string[] }[]) {
          resolutions[tie.group_index] = [...tie.player_ids].reverse(); result.tieDecisions++;
        }
        response = await finalize(manager, { batch_id: batch.id, tie_resolutions: resolutions });
      }
      expect(response.body, JSON.stringify(response)).toMatchObject({ success: true });
    }
    await verifyMovement(batch, groups, resolutions);
    const before = await snapshot(season);
    expect((await finalize(manager, { batch_id: batch.id })).body.already_finalized).toBe(true);
    expect(await snapshot(season)).toBe(before); result.retries++;
  }
  try {
    for (const user of [owner, manager, outsider, sub, replacement, ...roster])
      await db.query("INSERT INTO profiles(id,display_name,first_name,last_name) VALUES($1,$2,'Ladder','Simulation')", [user, `League ${scenario.number} ${user.slice(-4)}`]);
    league = await rpc<string>(owner, "create_league", { p_name: scenario.name, p_league_type: "ladder" });
    await leagueActor(db, owner)("UPDATE leagues SET status='active',rating_eligible=$2 WHERE id=$1", [league, !scenario.unranked]);
    season = (await leagueActor(db, owner)<{ id: string }>(
      "INSERT INTO league_seasons(league_id,name,status,start_date,end_date) VALUES($1,'Matrix season','active','2027-01-04','2027-02-28') RETURNING id", [league])).rows[0].id;
    result.seasonId = season;
    await leagueActor(db, owner)("INSERT INTO league_members(league_id,season_id,user_id,role) VALUES($1,$2,$3,'manager')", [league, season, manager]);
    await act("INSERT INTO league_members(league_id,season_id,user_id) SELECT $1,$2,unnest($3::uuid[])", [league, season, roster]);
    await act("INSERT INTO ladder_settings(league_id,season_id,batches_per_week,total_weeks,court_count,auto_advance,self_report_scoring) VALUES($1,$2,$3,$4,$5,$6,$7)",
      [league, season, scenario.batches, scenario.weeks, scenario.courts, !!scenario.auto, scenario.scoring === "self"]);
    for (let week = 1; week <= scenario.weeks; week++) if (!(week === 2 && scenario.action === "schedule-gate")) await schedule(week);
    if (["subs", "sitouts", "pending-gate"].includes(scenario.action ?? "")) {
      const absent = scenario.action === "sitouts" ? roster.slice(4, 8) : [roster[0]];
      if (scenario.action === "subs") await act("INSERT INTO league_substitutes(league_id,season_id,user_id) VALUES($1,$2,$3)", [league, season, sub]);
      for (const player of absent) {
        const request = await rpc<{ request_id: string }>(player, "request_ladder_sub", { p_season_id: season, p_session_id: sessions[1], p_note: "Away in week two" });
        if (scenario.action === "pending-gate") pendingRequest = request.request_id;
        else await rpc(manager, "resolve_ladder_sub_request", { p_request_id: request.request_id,
          p_resolution: scenario.action === "subs" ? "sub" : "sitout", p_assigned_sub_id: scenario.action === "subs" ? sub : null });
      }
    }
    const openingArgs = { season_id: season, session_id: sessions[0], order: roster };
    const beforeStart = await snapshot(season);
    expect((await first(outsider, openingArgs)).status).toBeGreaterThanOrEqual(400);
    expect(await snapshot(season)).toBe(beforeStart); result.rejectedActions++;
    const opening = await first(manager, openingArgs);
    expect(opening.body, JSON.stringify(opening)).toMatchObject({ success: true });
    const started = await snapshot(season);
    expect((await first(manager, openingArgs)).status).toBe(200);
    expect(await snapshot(season)).toBe(started); result.retries++;

    for (let stage = 0; stage < scenario.weeks * scenario.batches; stage++) {
      const week = Math.floor(stage / scenario.batches) + 1, batchNumber = stage % scenario.batches + 1;
      setWeek(week);
      if (scenario.action === "replace" && week === 2 && batchNumber === 1) {
        await act("INSERT INTO league_members(league_id,season_id,user_id) VALUES($1,$2,$3)", [league, season, replacement]);
        await rejectUnchanged(() => rpc(roster[0], "ladder_replace_player", { p_season_id: season, p_out_user_id: roster[0], p_in_user_id: replacement }), /privileges/i);
        await rpc(manager, "ladder_replace_player", { p_season_id: season, p_out_user_id: roster[0], p_in_user_id: replacement });
      }
      if (stage > 0 && !scenario.auto) {
        const generated = await next(manager, { season_id: season, session_id: sessions[week - 1] });
        expect(generated.body, JSON.stringify(generated)).toMatchObject({ success: true, week, batch: batchNumber });
        expect(generated.body.sub_seed_errors).toBeUndefined();
      }
      const batch = (await rows<Batch>("SELECT * FROM ladder_batches WHERE season_id=$1 AND week_number=$2 AND batch_number=$3", [season, week, batchNumber]))[0];
      expect(batch).toBeDefined();
      const groups = await rows<Group>("SELECT * FROM ladder_batch_groups WHERE batch_id=$1 ORDER BY group_index", [batch.id]);
      const draw = await games(batch.id);
      const present = scenario.players - (scenario.action === "sitouts" && week === 2 ? 4 : 0);
      expect(groups).toHaveLength(present / 4); expect(draw).toHaveLength(present * 3 / 4);
      expect(new Set(groups.map(g => `${g.wave}:${g.court_number}`)).size).toBe(groups.length);
      expect(groups.every(g => g.court_number > 0 && g.court_number <= scenario.courts)).toBe(true);
      const activePlayers = new Set(draw.flatMap(slots)); expect(activePlayers.size).toBe(present);
      for (const player of activePlayers) {
        const own = draw.filter(game => slots(game).includes(player)); expect(own).toHaveLength(3);
        expect(new Set(own.map(game => slots(game)[slots(game).indexOf(player) ^ 1])).size).toBe(3);
      }
      if (scenario.action === "subs") {
        expect(activePlayers.has(sub)).toBe(week === 2); expect(activePlayers.has(roster[0])).toBe(week !== 2);
      }
      if (scenario.action === "sitouts") for (const player of roster.slice(4, 8)) expect(activePlayers.has(player)).toBe(week !== 2);
      if (scenario.action === "replace" && week >= 2) { expect(activePlayers.has(replacement)).toBe(true); expect(activePlayers.has(roster[0])).toBe(false); }
      await blocked(() => next(manager, { season_id: season }), "error", "current_stage_not_processed");
      await blocked(() => finalize(manager, { batch_id: batch.id }), "error", "batch_incomplete");
      if (scenario.auto) await blocked(() => advance(roster[0], { season_id: season }), "skipped", "incomplete");
      await rejectUnchanged(() => act("UPDATE league_seasons SET status='completed' WHERE id=$1", [season]), /Finish, resolve, or cancel all open matches/i);
      for (const [index, game] of draw.entries()) {
        const gi = groups.find(g => g.id === game.ladder_batch_group_id)!.group_index;
        const scores = scenario.ties ? [11, 7] : [[11, 0], [11, 6], [13, 11]][game.ladder_game_number - 1];
        const [a, b] = (stage + gi + scenario.number) % 2 ? [...scores].reverse() : scores;
        const submitter = scenario.scoring === "manager" ? manager : game.player_a_id!;
        if (index === 0) {
          await rejectUnchanged(() => submit(game, a, b, outsider), /participant/i);
          await rejectUnchanged(() => submit(game, 11, 11, submitter), /non-negative|tied|distinct/i);
          await rejectUnchanged(() => submit(game, -1, 11, submitter), /non-negative/i);
        }
        await submit(game, a, b, submitter);
        if (scenario.scoring === "confirmed") {
          if (index === 0) {
            await confirm(game, a, b, submitter);
            expect((await rows<Game>("SELECT * FROM league_matches WHERE id=$1", [game.id]))[0].status).toBe("score_submitted");
            await rejectUnchanged(() => confirm(game, a + 1, b), /score changed/i);
          }
          if (scenario.action === "correct" && stage === 0 && index === 0) {
            await rpc(game.player_c_id!, "dispute_league_match", { p_match_id: game.id, p_reason: "Confirm the posted result" });
            await rejectUnchanged(() => submit(game, a, b, submitter), /organizer/i);
            await submit(game, a, b, manager);
          } else await confirm(game, a, b);
        }
        ledger.set(game.id, { slots: slots(game), a, b });
        if (index === 0) {
          if (scenario.scoring === "confirmed" && !(scenario.action === "correct" && stage === 0)) {
            const before = await snapshot(season);
            await confirm(game, a, b);
            expect(await snapshot(season)).toBe(before); result.retries++;
          } else {
            // Manager/self-report verification needs no second confirmation.
            await rejectUnchanged(() => confirm(game, a, b), /not awaiting verification/i);
          }
        }
      }
      await reconcile();
      await process(batch, groups);
      await rejectUnchanged(() => act("UPDATE league_matches SET team_a_score=15,team_b_score=2,status='verified' WHERE id=$1", [draw[0].id]), /reopen/i);
      if (scenario.action === "correct" && stage === 0) {
        const downstream = await next(manager, { season_id: season });
        const toRemove = await games(downstream.body.batch_id as string);
        await submit(toRemove[0], 11, 4, manager);
        const removedLink = (await rows<Game>("SELECT * FROM league_matches WHERE id=$1", [toRemove[0].id]))[0].linked_match_id;
        expect(removedLink).toBeTruthy();
        await rejectUnchanged(() => rpc(manager, "ladder_reopen_batch", { p_batch_id: batch.id }), /already-played/i);
        const reopened = await rpc(manager, "ladder_reopen_batch", { p_batch_id: batch.id, p_force: true });
        expect(reopened).toMatchObject({ downstream_batches_removed: 1, downstream_played_games_discarded: 1, rating_rows_removed: 1, auto_advance_paused: true });
        expect(await rows("SELECT id FROM matches WHERE id=$1", [removedLink])).toHaveLength(0);
        expect(await rows("SELECT id FROM match_participants WHERE match_id=$1", [removedLink])).toHaveLength(0);
        // The organizer's score editor uses an RLS-protected update after reopen.
        await act("UPDATE league_matches SET team_a_score=15,team_b_score=2,status='verified' WHERE id=$1", [draw[0].id]);
        ledger.set(draw[0].id, { slots: slots(draw[0]), a: 15, b: 2 });
        await reconcile(); await process(batch, groups);
      }
    }
    await reconcile();
    expect(ledger.size).toBe(scenario.players / 4 * 3 * scenario.weeks * scenario.batches
      - (scenario.action === "sitouts" ? 3 * scenario.batches : 0));
    expect((await next(manager, { season_id: season })).body.done).toBe(true);
    await act("UPDATE league_seasons SET status='completed' WHERE id=$1", [season]);
    expect((await rows("SELECT status,auto_advance FROM ladder_settings WHERE season_id=$1", [season]))[0]).toEqual({ status: "complete", auto_advance: false });
    await blocked(() => advance(roster[0], { season_id: season }), "skipped", "auto_advance_off");
    expect(await rows("SELECT id FROM ladder_batches WHERE season_id=$1 AND status='finalized'", [season])).toHaveLength(result.batches);
    expect((await leagueActor(db, outsider)("SELECT id FROM league_matches WHERE season_id=$1", [season])).rows).toHaveLength(0);
    for (const [previous, state] of archived) expect(await snapshot(previous)).toBe(state);
    archived.set(season, await snapshot(season)); result.status = "passed";
  } catch (error) { result.status = "failed"; result.error = (error as Error).message; throw error; }
  finally { result.durationMs = Math.round(performance.now() - began); console.info("LADDER_SEASON_RESULT", JSON.stringify(result)); }
}, 120_000);

it("reconciles all completed leagues with no orphaned rating inputs or cross-season changes", async () => {
  expect(results).toHaveLength(scenarios.length);
  expect(results.every(r => r.status === "passed")).toBe(true);
  for (const [season, state] of archived) expect(await snapshot(season)).toBe(state);
  const total = (await rows<{ completed: number; games: number; inputs: number; participants: number }>(`SELECT
    (SELECT count(*)::int FROM league_seasons WHERE status='completed') completed,
    (SELECT count(*)::int FROM league_matches WHERE status='verified') games,
    (SELECT count(*)::int FROM matches WHERE NOT voided) inputs,
    (SELECT count(*)::int FROM match_participants) participants`))[0];
  expect(total).toEqual({ completed: scenarios.length, games: results.reduce((n, r) => n + r.games, 0),
    inputs: results.reduce((n, r) => n + r.ratingInputs, 0), participants: results.reduce((n, r) => n + r.ratingInputs * 4, 0) });
  expect(await rows("SELECT m.id FROM matches m LEFT JOIN league_matches lm ON lm.linked_match_id=m.id WHERE lm.id IS NULL")).toHaveLength(0);
  finalReconciliation = "passed";
});
