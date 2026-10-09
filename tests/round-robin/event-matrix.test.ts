import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createScoringDatabase } from './fixtures/scoring-database';
import { installControlSchema } from './fixtures/control-schema';
import { planScheduleAdjustment } from '../../src/lib/roundRobin/scheduleAdjustment';
import { seatsOf, type CoreMatch, type EventFormat } from '../../src/lib/roundRobin/scheduleCore';
import { computeStandings, countsTowardScore, type StandingsSeatRow } from '../../src/lib/roundRobin/standings';
import { projectRosterAdjustment, planWithRosterFallback, type RosterAdjustment, type RosterMatch } from '../../supabase/functions/_shared/roundRobin/rosterAdjustment';

// Complete events, not repeated assertions against one event. Selected events coexist in
// one isolated database; no production credentials or network access are used.
type Scenario = { name: string; players: number; courts: number; games: number; format?: EventFormat;
  guests?: boolean; claimed?: boolean; unranked?: boolean; action?: string; burst?: boolean };
const baselineScenarios: Scenario[] = [
  { name: 'Four-player baseline', players: 4, courts: 1, games: 4 },
  { name: 'Five players rotating rests', players: 5, courts: 1, games: 4 },
  { name: 'Six players on one court', players: 6, courts: 1, games: 4 },
  { name: 'Seven players with spare court capacity', players: 7, courts: 2, games: 4 },
  { name: 'Nine players and an odd roster', players: 9, courts: 2, games: 4 },
  { name: 'Ten-player mixed doubles', players: 10, courts: 2, games: 6, format: 'mixed' },
  { name: 'Mens doubles', players: 12, courts: 3, games: 6, format: 'male' },
  { name: 'Womens doubles', players: 12, courts: 3, games: 6, format: 'female' },
  { name: 'Eighteen-player mixed rotation', players: 18, courts: 4, games: 6, format: 'mixed' },
  { name: 'Twenty-two-player mixed rotation', players: 22, courts: 5, games: 6, format: 'mixed' },
  { name: 'Ranked twenty-four-player event', players: 24, courts: 6, games: 8 },
  { name: 'Unranked twenty-four-player event', players: 24, courts: 6, games: 8, unranked: true },
  { name: 'Registered players and unclaimed guests', players: 8, courts: 2, games: 4, guests: true },
  { name: 'Claimed guest account history', players: 12, courts: 3, games: 6, guests: true, claimed: true },
  { name: 'Mixed doubles with guests', players: 16, courts: 4, games: 8, format: 'mixed', guests: true },
  { name: 'One-round resting-player replacement', players: 22, courts: 5, games: 6, action: 'one-resting' },
  { name: 'One-round new registered replacement', players: 16, courts: 4, games: 6, action: 'one-new' },
  { name: 'One-round new guest replacement', players: 12, courts: 3, games: 6, action: 'one-guest' },
  { name: 'Resting replacement for current and future play', players: 22, courts: 5, games: 6, action: 'roster-resting' },
  { name: 'New replacement for current and future play', players: 16, courts: 4, games: 8, action: 'roster-new' },
  { name: 'Guest replacement for future rounds only', players: 16, courts: 4, games: 8, action: 'roster-guest-future' },
  { name: 'Departure after finishing current match', players: 12, courts: 3, games: 8, action: 'remove-keep' },
  { name: 'Departure abandoning current match', players: 12, courts: 3, games: 8, action: 'remove-abandon' },
  { name: 'Live partner opponent and court edits', players: 20, courts: 5, games: 8, action: 'edit' },
  { name: 'Score correction before and after completion', players: 12, courts: 3, games: 6, action: 'correct' },
  { name: 'Voided result excluded from totals', players: 12, courts: 3, games: 6, action: 'void' },
  { name: 'Forced transaction failure and recovery', players: 16, courts: 4, games: 8, action: 'rollback' },
  { name: 'Stale edits and lost-response replay', players: 16, courts: 4, games: 8, action: 'stale' },
  { name: 'Thirty-two players twenty games burst scoring', players: 32, courts: 8, games: 20, burst: true },
  { name: 'Sixty-four players twelve games burst scoring', players: 64, courts: 16, games: 12, burst: true },
  { name: 'One hundred twenty-eight players eight games', players: 128, courts: 16, games: 8, burst: true },
  { name: 'Thirty-two mixed players twenty games', players: 32, courts: 8, games: 20, format: 'mixed', burst: true },
];
// A fresh set with different event IDs/seeds and combinations of existing rules.
// Keep these separate so a follow-up run reports only genuinely additional games.
const additionalScenarios: Scenario[] = [
  { name: 'Mixed doubles one-round registered substitute', players: 8, courts: 2, games: 6, format: 'mixed', action: 'one-new' },
  { name: 'Mixed doubles one-round guest substitute', players: 8, courts: 2, games: 6, format: 'mixed', action: 'one-guest' },
  { name: 'Mixed doubles permanent registered substitute', players: 12, courts: 3, games: 6, format: 'mixed', action: 'roster-new' },
  { name: 'Mixed doubles guest substitute for future play', players: 12, courts: 3, games: 6, format: 'mixed', action: 'roster-guest-future' },
  { name: 'Womens claimed-guest score corrections', players: 8, courts: 2, games: 4, format: 'female', guests: true, claimed: true, action: 'correct' },
  { name: 'Mens unranked event with a voided result', players: 12, courts: 3, games: 4, format: 'male', unranked: true, action: 'void' },
  { name: 'Six-player single-court scoring failure recovery', players: 6, courts: 1, games: 8, action: 'rollback' },
  { name: 'Mixed doubles departure after the current game', players: 14, courts: 3, games: 6, format: 'mixed', action: 'remove-keep' },
  { name: 'Claimed guests with live edits and stale submissions', players: 20, courts: 5, games: 6, guests: true, claimed: true, action: 'stale' },
  { name: 'Twenty-eight players burst scoring on seven courts', players: 28, courts: 7, games: 6, burst: true },
  { name: 'Unranked mixed doubles burst with claimed guests', players: 24, courts: 6, games: 8, format: 'mixed', guests: true, claimed: true, unranked: true, burst: true },
  { name: 'Womens doubles departure abandoning a game', players: 8, courts: 2, games: 6, format: 'female', action: 'remove-abandon' },
];
const suite = process.env.RR_EVENT_MATRIX_SUITE ?? 'all';
if (!['all', 'baseline', 'additional'].includes(suite)) throw new Error(`Unknown event matrix suite: ${suite}`);
const scenarios = [...baselineScenarios, ...additionalScenarios].map((scenario, i) => ({ ...scenario, number: i + 1 }))
  .filter(scenario => suite === 'all' || (suite === 'additional' ? scenario.number > baselineScenarios.length : scenario.number <= baselineScenarios.length));
const slots = ['a1', 'a2', 'b1', 'b2'] as const;
const uuid = (n: number) => `a8000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
type Row = RosterMatch & StandingsSeatRow & { id: string; event_id: string; match_id: string | null; voided_at: string | null; superseded_by_schedule_id: string | null };
type Roster = { id: string; player_id: string | null; guest_player_id: string | null; active: boolean; schedule_game_credit: number; schedule_first_eligible_round: number };
type Event = { status: string; current_round: number; num_rounds: number; schedule_version: number; games_per_player: number; equal_games: boolean };
type Result = { number: number; name: string; players: number; courts: number; format: string; action?: string; targetGames: number; eventId: string; status: string;
  rounds: number; scoredMatches: number; scoreCalls: number; retries: number; rejectedChanges: number; mutations: number; participantResults: number; fullRatingReplays: number; durationMs: number; error?: string };
const results: Result[] = [];
const scoreTimings: number[] = [];
let finalReconciliation = 'not_run';
let db: PGlite;
let nextRequest = 9_000_000;
beforeAll(async () => {
  db = await createScoringDatabase(); await installControlSchema(db);
  // The small unit fixture omits indexes. Load these existing production
  // definitions so growing-history runs do not benchmark an unindexed schema.
  const indexSql = readFileSync('supabase/migrations/20260629175740_ab696bf1-3720-46a9-9c4a-7ba359b144b9.sql', 'utf8');
  await db.exec(indexSql.match(/CREATE INDEX IF NOT EXISTS idx_match_participants_player_match[^;]+;/)![0]);
  const schemaSql = readFileSync('supabase/migrations/20251020142332_f3ec0748-87ff-437c-8f72-2d895d1b8dbe.sql', 'utf8');
  for (const name of ['idx_round_robin_players_event', 'idx_round_robin_players_player', 'idx_round_robin_schedule_event_round']) {
    await db.exec(schemaSql.match(new RegExp(`CREATE INDEX ${name}[^;]+;`))![0]);
  }
  // Add a diagnostic counter before the original production function body.
  const definition = (await db.query<{ definition: string }>("SELECT pg_get_functiondef('public.recalculate_all_ratings()'::regprocedure) AS definition")).rows[0].definition;
  await db.exec(definition.replace(/\bBEGIN\b/i, "BEGIN\n PERFORM set_config('test.full_replays',(coalesce(nullif(current_setting('test.full_replays',true),''),'0')::int+1)::text,false);"));
}, 30_000);
afterAll(async () => {
  await db?.close();
  if (process.env.RR_EVENT_MATRIX_REPORT) {
    const sorted = [...scoreTimings].sort((a, b) => a - b);
    const report = { environment: 'Isolated PGlite with production SQL functions and rating/stat triggers; synthetic auth/schema; no HTTP, realtime delivery, or multi-connection load',
      generatedAt: new Date().toISOString(), suite, expectedEvents: scenarios.length, finalReconciliation, events: results,
      totals: { events: results.length, passed: results.filter(r => r.status === 'passed').length,
        scoredMatches: results.reduce((n, r) => n + r.scoredMatches, 0), scoreCalls: results.reduce((n, r) => n + r.scoreCalls, 0),
        retries: results.reduce((n, r) => n + r.retries, 0), rejectedChanges: results.reduce((n, r) => n + r.rejectedChanges, 0),
        mutations: results.reduce((n, r) => n + r.mutations, 0), participantResults: results.reduce((n, r) => n + r.participantResults, 0) },
      localScoreTiming: { samples: sorted.length, medianMs: sorted[Math.floor(sorted.length / 2)], p95Ms: sorted[Math.ceil(sorted.length * .95) - 1], maxMs: sorted.at(-1) } };
    mkdirSync(dirname(process.env.RR_EVENT_MATRIX_REPORT), { recursive: true });
    writeFileSync(process.env.RR_EVENT_MATRIX_REPORT, JSON.stringify(report, null, 2));
    console.info('RR_EVENT_MATRIX_TOTALS', JSON.stringify(report.totals));
  }
});
const seatOf = (r: Roster) => r.player_id ? `p:${r.player_id}` : `g:${r.guest_player_id}`;
const scheduleJson = (matches: CoreMatch[]) => matches.map(m => ({ round_no: m.round_no, court_no: m.court_no, is_bye: m.is_bye,
  ...Object.fromEntries(slots.flatMap(s => [[`${s}_player_id`, m[s]?.startsWith('p:') ? m[s]!.slice(2) : null], [`${s}_guest_id`, m[s]?.startsWith('g:') ? m[s]!.slice(2) : null]])) }));

it.each(scenarios)('event $number: $name', async scenario => {
  const began = performance.now();
  const base = scenario.number * 10_000;
  const eventId = uuid(base), owner = uuid(base + 1);
  const result: Result = { number: scenario.number, name: scenario.name, players: scenario.players, courts: scenario.courts, format: scenario.format ?? 'open', action: scenario.action, targetGames: scenario.games,
    eventId, status: 'running', rounds: 0, scoredMatches: 0, scoreCalls: 0, retries: 0, rejectedChanges: 0, mutations: 0, participantResults: 0, fullRatingReplays: 0, durationMs: 0 };
  results.push(result);
  const genders = new Map<string, 'male' | 'female'>();
  const profileIds: string[] = [];
  async function rpc<T>(name: string, args: unknown[], actor = owner): Promise<T> {
    await db.query("SELECT set_config('test.uid',$1,false)", [actor]);
    await db.exec('SET ROLE authenticated');
    try { return (await db.query<{ result: T }>(`SELECT ${name}(${args.map((_, i) => `$${i + 1}`).join(',')}) AS result`, args)).rows[0].result; }
    finally { await db.exec('RESET ROLE'); }
  }
  async function state() {
    const evt = (await db.query<Event>('SELECT * FROM round_robin_events WHERE id=$1', [eventId])).rows[0];
    const raw = (await db.query<Record<string, unknown>>('SELECT * FROM round_robin_schedule WHERE event_id=$1 AND voided_at IS NULL AND superseded_by_schedule_id IS NULL ORDER BY round_no,court_no,id', [eventId])).rows;
    const matches = raw.map(r => ({ ...r, ...Object.fromEntries(slots.map(s => [s, r[`${s}_player_id`] ? `p:${r[`${s}_player_id`]}` : r[`${s}_guest_id`] ? `g:${r[`${s}_guest_id`]}` : null])) })) as unknown as Row[];
    const roster = (await db.query<Roster>('SELECT * FROM round_robin_players WHERE event_id=$1 ORDER BY id', [eventId])).rows;
    return { evt, matches, roster };
  }
  const version = async () => (await state()).evt.schedule_version;
  async function snapshot() {
    return { ...(await state()), profiles: (await db.query('SELECT * FROM profiles WHERE id=ANY($1::uuid[]) ORDER BY id', [profileIds])).rows,
      history: (await db.query('SELECT * FROM matches WHERE created_by=$1 ORDER BY id', [owner])).rows,
      audit: (await db.query('SELECT * FROM round_robin_audit WHERE event_id=$1 ORDER BY changes::text', [eventId])).rows,
      requests: (await db.query('SELECT * FROM rr_schedule_mutation_requests WHERE event_id=$1 ORDER BY request_id', [eventId])).rows };
  }
  async function rejectUnchanged(action: () => Promise<unknown>, reason: RegExp) {
    const before = await snapshot();
    await expect(action()).rejects.toThrow(reason);
    result.rejectedChanges++;
    expect(await snapshot()).toEqual(before);
  }
  async function addIdentity(index: number, guest = false, claimed = false, requestedGender?: 'male' | 'female') {
    const id = uuid(base + index);
    const gender = requestedGender ?? (scenario.format === 'male' || scenario.format === 'female' ? scenario.format : index % 2 ? 'female' : 'male');
    if (!guest || claimed) {
      const profile = claimed ? uuid(base + index + 1000) : id;
      await db.query('INSERT INTO profiles(id,gender) VALUES($1,$2)', [profile, gender]); profileIds.push(profile);
    }
    if (guest) await db.query('INSERT INTO guest_players(id,created_by,gender,linked_user_id) VALUES($1,$2,$3,$4)', [id, owner, gender, claimed ? uuid(base + index + 1000) : null]);
    const seat = `${guest ? 'g' : 'p'}:${id}`; genders.set(seat, gender); return seat;
  }
  async function score(row: Row, a: number, b: number) {
    const started = performance.now(); result.scoreCalls++;
    // The burst path queues the same public SQL entry point on one database
    // connection. It is volume/idempotency coverage, not network concurrency.
    const reviewed = await version();
    const saved = await db.query<{ id: string }>('SELECT submit_rr_match_score($1,$2,$3,$4) AS id', [row.id, a, b, reviewed]);
    scoreTimings.push(performance.now() - started); return saved.rows[0].id;
  }
  async function edit(action: string, row: Row, other: Row | null = null, court: number | null = null) {
    const response = await rpc<{ ok: boolean }>('rr_edit_schedule', [uuid(nextRequest++), eventId, await version(), action, row.id, other?.id ?? null, court, 'Event matrix']);
    expect(response.ok).toBe(true); result.mutations++;
  }
  async function adjust(change: RosterAdjustment) {
    const before = await state(), active = before.roster.filter(r => r.active).map(seatOf);
    const projection = projectRosterAdjustment(active, before.matches, before.evt.current_round, change);
    const plan = planWithRosterFallback({ seed: eventId, currentMatches: projection.matches, currentSeatIds: active, nextSeatIds: projection.nextSeatIds,
      currentTotalRounds: before.evt.num_rounds, firstMutableRound: before.evt.current_round + 1, numCourts: scenario.courts, gamesPerPlayer: before.evt.games_per_player,
      equalGames: before.evt.equal_games, format: scenario.format ?? 'open', genders,
      existingGameCredits: new Map(before.roster.map(r => [seatOf(r), r.schedule_game_credit])),
      existingFirstEligibleRounds: new Map(before.roster.map(r => [seatOf(r), r.schedule_first_eligible_round])),
      substitutions: projection.substitution ? [projection.substitution] : [] }, true);
    expect(plan.ok, JSON.stringify(plan.warnings)).toBe(true);
    const args = [uuid(nextRequest++), eventId, owner, before.evt.schedule_version, before.evt.current_round + 1, scenario.courts,
      plan.capacity.recommendedTotalRounds, plan.capacity.gamesPerPlayerTarget, JSON.stringify(scheduleJson(plan.generatedMatches)), JSON.stringify({ capacity: plan.capacity }),
      'Event matrix roster adjustment', projection.substitution ? JSON.stringify(projection.substitution) : null,
      JSON.stringify(plan.fairness.perPlayer.map(p => ({ seat_id: p.seatId, game_credit: plan.gameCredits.get(p.seatId) ?? 0, first_eligible_round: plan.firstEligibleRounds.get(p.seatId) ?? 1 }))),
      JSON.stringify({ ...change, allowBalanced: true })];
    const apply = () => db.query('SELECT rr_apply_roster_adjustment($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)', args);
    await apply(); result.mutations++;
    const saved = await snapshot(); await apply(); result.retries++; expect(await snapshot()).toEqual(saved);
    const after = await state();
    expect(after.matches.filter(m => m.round_no < before.evt.current_round)).toEqual(before.matches.filter(m => m.round_no < before.evt.current_round));
    expect(after.matches.filter(m => m.round_no > before.evt.current_round).flatMap(seatsOf)).not.toContain(change.outgoingSeatId);
    if (!change.includeCurrent && change.resolution !== 'abandon') expect(after.matches.filter(m => m.round_no === before.evt.current_round)).toEqual(before.matches.filter(m => m.round_no === before.evt.current_round));
  }
  async function verifyAssignments() {
    const { evt, matches, roster } = await state();
    for (const round of new Set(matches.map(m => m.round_no))) {
      const rows = matches.filter(m => m.round_no === round), playable = rows.filter(m => !m.is_bye);
      const seats = rows.flatMap(seatsOf);
      expect(new Set(seats).size, `round ${round} double-booking`).toBe(seats.length);
      expect(playable.length).toBeLessThanOrEqual(scenario.courts);
      expect(new Set(playable.map(m => m.court_no)).size).toBe(playable.length);
      for (const row of playable) {
        expect(seatsOf(row)).toHaveLength(4);
        if (scenario.format === 'mixed') {
          expect(genders.get(row.a1!)).not.toBe(genders.get(row.a2!));
          expect(genders.get(row.b1!)).not.toBe(genders.get(row.b2!));
        }
      }
      if (round > evt.current_round) expect([...seats].sort()).toEqual(roster.filter(r => r.active).map(seatOf).sort());
    }
  }
  async function reconcile() {
    const { matches, roster } = await state();
    const participants = new Map(roster.map(r => [seatOf(r).slice(2), { key: seatOf(r).slice(2), name: seatOf(r), active: r.active }]));
    for (const seat of matches.flatMap(seatsOf)) if (!participants.has(seat.slice(2))) participants.set(seat.slice(2), { key: seat.slice(2), name: seat, active: false });
    const standings = computeStandings(matches, [...participants.values()]);
    const history = (await db.query<{ id: string; team1_score: number; team2_score: number; count_for_rating: boolean }>('SELECT * FROM matches WHERE created_by=$1 AND NOT voided', [owner])).rows;
    const counted = matches.filter(countsTowardScore);
    expect(history).toHaveLength(counted.length);
    expect(new Set(counted.map(m => m.match_id)).size).toBe(counted.length);
    for (const row of counted) {
      // Guest substitutions in round 2 intentionally disable rating eligibility
      // for subsequent saves across the event. Earlier results keep their policy,
      // including when the host corrects them after the event is complete.
      const afterGuestIntroduced = row.round_no >= 2 && ['one-guest', 'roster-guest-future'].includes(scenario.action ?? '');
      expect(history.find(m => m.id === row.match_id)).toMatchObject({ team1_score: row.team1_score, team2_score: row.team2_score,
        count_for_rating: !scenario.unranked && !afterGuestIntroduced && seatsOf(row).every(seat => seat.startsWith('p:')) });
    }
    expect(standings.reduce((n, r) => n + r.gamesPlayed, 0)).toBe(counted.length * 4);
    expect(standings.reduce((n, r) => n + r.wins, 0)).toBe(counted.length * 2);
    expect(standings.reduce((n, r) => n + r.pointDiff, 0)).toBe(0);
    // Independent database aggregation, including linked guest account mapping.
    const persisted = (await db.query<{ player_id: string | null; guest_player_id: string | null; games: number; wins: number; losses: number; pf: number; pa: number }>(`
      SELECT mp.player_id,mp.guest_player_id,count(*)::int games,
        count(*) FILTER(WHERE (mp.team=1 AND m.team1_score>m.team2_score) OR (mp.team=2 AND m.team2_score>m.team1_score))::int wins,
        count(*) FILTER(WHERE (mp.team=1 AND m.team1_score<m.team2_score) OR (mp.team=2 AND m.team2_score<m.team1_score))::int losses,
        sum(CASE WHEN mp.team=1 THEN m.team1_score ELSE m.team2_score END)::int pf,
        sum(CASE WHEN mp.team=1 THEN m.team2_score ELSE m.team1_score END)::int pa
      FROM match_participants mp JOIN matches m ON m.id=mp.match_id WHERE m.created_by=$1 AND NOT m.voided GROUP BY mp.player_id,mp.guest_player_id`, [owner])).rows;
    for (const p of persisted) {
      const standing = standings.find(s => s.key === (p.guest_player_id ?? p.player_id));
      expect(standing).toMatchObject({ gamesPlayed: p.games, wins: p.wins, losses: p.losses, pointsFor: p.pf, pointsAgainst: p.pa });
    }
    const profiles = (await db.query<{ id: string; total_matches: number; wins: number; losses: number; total_points_for: number; total_points_against: number; current_rating: string }>('SELECT * FROM profiles WHERE id=ANY($1::uuid[])', [profileIds])).rows;
    for (const p of profiles) {
      const rows = persisted.filter(r => r.player_id === p.id);
      const total = (field: 'games' | 'wins' | 'losses' | 'pf' | 'pa') => rows.reduce((n, r) => n + r[field], 0);
      expect(p).toMatchObject({ total_matches: total('games'), wins: total('wins'), losses: total('losses'), total_points_for: total('pf'), total_points_against: total('pa') });
      expect(Number.isFinite(Number(p.current_rating))).toBe(true);
      if (scenario.unranked) expect(Number(p.current_rating)).toBe(3.5);
    }
    if (scenario.unranked) expect(history.every(m => !m.count_for_rating)).toBe(true);
    result.scoredMatches = counted.length; result.participantResults = persisted.reduce((n, p) => n + p.games, 0);
  }
  try {
    await db.query("SELECT set_config('test.uid',$1,false),set_config('test.mfa','true',false),set_config('test.full_replays','0',false)", [owner]);
    await db.query("INSERT INTO round_robin_events(id,organizer_id,name,status,num_courts,games_per_player,format,rating_eligible,max_players,equal_games) VALUES($1,$2,$3,'draft',$4,$5,$6,$7,$8,true)",
      [eventId, owner, scenario.name, scenario.courts, scenario.games, scenario.format ?? 'open', !scenario.unranked, Math.max(scenario.players + 4, 8)]);
    const seats: string[] = [];
    for (let i = 0; i < scenario.players; i++) {
      const guest = !!scenario.guests && i % 4 === 0;
      const seat = await addIdentity(100 + i, guest, guest && scenario.claimed); seats.push(seat);
      await db.query('INSERT INTO round_robin_players(event_id,player_id,guest_player_id) VALUES($1,$2,$3)', [eventId, guest ? null : seat.slice(2), guest ? seat.slice(2) : null]);
    }
    const initial = planScheduleAdjustment({ seed: eventId, currentMatches: [], currentSeatIds: seats, nextSeatIds: seats,
      currentTotalRounds: 1, firstMutableRound: 1, numCourts: scenario.courts, gamesPerPlayer: scenario.games, equalGames: true, format: scenario.format ?? 'open', genders });
    expect(initial.ok, JSON.stringify(initial.warnings)).toBe(true);
    expect(initial.fairness.gameRange.spread).toBe(0);
    for (const row of scheduleJson(initial.schedule)) await db.query('INSERT INTO round_robin_schedule SELECT * FROM jsonb_populate_record(NULL::round_robin_schedule,$1::jsonb)', [JSON.stringify({ id: uuid(nextRequest++), event_id: eventId, abandoned: false, ...row })]);
    await db.query('UPDATE round_robin_events SET num_rounds=$1,games_per_player=$2 WHERE id=$3', [initial.capacity.recommendedTotalRounds, initial.capacity.gamesPerPlayerTarget, eventId]);
    await rpc('rr_start_event', [eventId, 0]);
    await verifyAssignments();
    let changed = false;
    for (let guard = 0; guard < 100; guard++) {
      let { evt, matches, roster } = await state();
      if (evt.current_round === 2 && scenario.action && !changed) {
        const current = matches.filter(m => m.round_no === 2 && !m.is_bye), outgoing = current[0].a1!;
        if (scenario.action.startsWith('one-')) {
          const incoming = scenario.action === 'one-resting' ? matches.find(m => m.round_no === 2 && m.is_bye)!.a1! : await addIdentity(800, scenario.action === 'one-guest', false, genders.get(outgoing));
          const original = roster.find(r => seatOf(r) === outgoing)!;
          if (scenario.format === 'mixed') {
            const wrongGender = await addIdentity(801, false, false, genders.get(outgoing) === 'male' ? 'female' : 'male');
            await rejectUnchanged(() => rpc('rr_substitute_round', [uuid(nextRequest++), eventId, evt.schedule_version, 2, original.id, wrongGender.slice(2), null, 'Invalid mixed pairing']), /mixed|male.*female/i);
          }
          const args = [uuid(nextRequest++), eventId, evt.schedule_version, 2, original.id, incoming.startsWith('p:') ? incoming.slice(2) : null, incoming.startsWith('g:') ? incoming.slice(2) : null, 'One round matrix'];
          await rpc('rr_substitute_round', args); result.mutations++;
          const saved = await snapshot(); await rpc('rr_substitute_round', args); result.retries++; expect(await snapshot()).toEqual(saved);
          expect((await state()).matches.filter(m => m.round_no !== 2)).toEqual(matches.filter(m => m.round_no !== 2));
          expect((await state()).roster).toEqual(roster);
        } else if (scenario.action.startsWith('roster-')) {
          const incoming = scenario.action === 'roster-resting' ? matches.find(m => m.round_no === 2 && m.is_bye)!.a1! : await addIdentity(800, scenario.action === 'roster-guest-future', false, genders.get(outgoing));
          await adjust({ outgoingSeatId: outgoing, incomingSeatId: incoming, includeCurrent: scenario.action !== 'roster-guest-future' });
        } else if (scenario.action.startsWith('remove-')) {
          await adjust({ outgoingSeatId: outgoing, resolution: scenario.action === 'remove-abandon' ? 'abandon' : 'keep_current' });
        } else if (scenario.action === 'edit' || scenario.action === 'stale') {
          const future = matches.filter(m => m.round_no === 3 && !m.is_bye);
          const oldVersion = evt.schedule_version;
          await edit('rotate_partners', future[0]);
          await edit('swap_opponents', future[0], future[1]);
          await edit('move_court', future[0], null, future[1].court_no);
          await rejectUnchanged(() => rpc('rr_edit_schedule', [uuid(nextRequest++), eventId, oldVersion, 'rotate_partners', future[0].id, null, null, null]), /STALE/);
          await rejectUnchanged(async () => rpc('rr_edit_schedule', [uuid(nextRequest++), eventId, await version(), 'rotate_partners', current[0].id, null, null, null]), /PROTECTED/);
          await rejectUnchanged(() => rpc('submit_rr_match_score', [future[0].id, 11, 7, oldVersion]), /lineup or round changed/);
        } else if (scenario.action === 'rollback') {
          await db.exec("ALTER TABLE round_robin_audit ADD CONSTRAINT matrix_forced_failure CHECK(change_type<>'score_submit') NOT VALID");
          try { await rejectUnchanged(() => score(current[0], 11, 7), /matrix_forced_failure/); }
          finally { await db.exec('ALTER TABLE round_robin_audit DROP CONSTRAINT matrix_forced_failure'); }
        }
        changed = true; await verifyAssignments(); ({ evt, matches, roster } = await state());
      }
      const current = matches.filter(m => m.round_no === evt.current_round && !m.is_bye && !m.abandoned);
      if (current.length) {
        await rejectUnchanged(() => rpc('rr_close_round', [eventId, evt.current_round]), /score|unscored|pending/i);
        if (evt.current_round === 1) {
          await rejectUnchanged(() => rpc('submit_rr_match_score', [current[0].id, 11, 11]), /at least 2 points/i);
          await rejectUnchanged(() => rpc('submit_rr_match_score', [current[0].id, 11, 7], uuid(base + 999)), /authorized/i);
          await db.query("SELECT set_config('test.uid',$1,false)", [owner]);
        }
        const save = async (m: Row, i: number) => {
          const scores = [[11, 0], [7, 11], [12, 10], [13, 15], [21, 19], [9, 11]][(evt.current_round + i) % 6];
          return score(m, scores[0], scores[1]);
        };
        if (scenario.burst) await Promise.all(current.map(save));
        else for (const [i, m] of current.entries()) await save(m, i);
        const savedFirst = (await state()).matches.find(m => m.id === current[0].id)!;
        const beforeRetry = await snapshot();
        expect(await score(savedFirst, savedFirst.team1_score!, savedFirst.team2_score!)).toBe(savedFirst.match_id);
        result.retries++; expect(await snapshot()).toEqual(beforeRetry);
        if (scenario.action === 'correct') await score(savedFirst, 3, 11);
        if (scenario.action === 'void' && evt.current_round === 2) {
          const args = [savedFirst.id, await version(), 'void', savedFirst.match_id, savedFirst.team1_score, savedFirst.team2_score];
          await rpc('rr_remove_match_result', args); result.mutations++;
          const removed = await snapshot(); await rpc('rr_remove_match_result', args); result.retries++; expect(await snapshot()).toEqual(removed);
        }
      }
      result.rounds++;
      await reconcile();
      ({ evt } = await state());
      if (evt.current_round === evt.num_rounds) break;
      expect(await rpc('rr_close_round', [eventId, evt.current_round])).toBe(evt.current_round + 1);
    }
    const finished = await state(); expect(finished.evt.current_round).toBe(finished.evt.num_rounds);
    const beforeComplete = (await snapshot()).profiles;
    const completed = await rpc<{ unscored: number }>('rr_complete_event', [eventId, finished.evt.schedule_version, 0]);
    expect(completed.unscored).toBe(0);
    const afterComplete = await snapshot();
    expect(afterComplete.profiles).toEqual(beforeComplete);
    expect(await rpc('rr_complete_event', [eventId, finished.evt.schedule_version, 0])).toEqual(completed);
    result.retries++; expect(await snapshot()).toEqual(afterComplete);
    expect((await state()).evt).toMatchObject({ status: 'completed', current_round: null });
    if (['correct', 'one-guest', 'roster-guest-future'].includes(scenario.action ?? '')) {
      await score(finished.matches.find(countsTowardScore)!, 11, 4); result.mutations++;
    }
    await reconcile();
    expect((await db.query("SELECT * FROM round_robin_audit WHERE event_id=$1 AND change_type='event_complete'", [eventId])).rows).toHaveLength(1);
    // A later event must never mutate an earlier event's lifecycle or history.
    expect(Number((await db.query<{ n: number }>("SELECT count(*)::int n FROM round_robin_events WHERE status='completed'")).rows[0].n)).toBe(results.filter(r => r.status === 'passed').length + 1);
    result.status = 'passed';
  } catch (error) {
    result.status = 'failed'; result.error = error instanceof Error ? error.message : String(error); throw error;
  } finally {
    result.fullRatingReplays = Number((await db.query<{ n: string }>("SELECT current_setting('test.full_replays',true) AS n")).rows[0].n);
    result.durationMs = Math.round(performance.now() - began); console.info('RR_EVENT_RESULT', JSON.stringify(result));
  }
}, 300_000);

it(`reconciles all ${scenarios.length} selected events and rating snapshots against a full history replay`, async () => {
  expect(results).toHaveLength(scenarios.length);
  expect(results.every(r => r.status === 'passed')).toBe(true);
  for (const result of results) expect(result.fullRatingReplays, result.name).toBe(result.action === 'correct' ? result.rounds + 1 : ['void', 'one-guest', 'roster-guest-future'].includes(result.action ?? '') ? 1 : 0);
  if (suite !== 'baseline') expect(results.filter(r => r.number > baselineScenarios.length).reduce((n, r) => n + r.scoredMatches, 0)).toBeGreaterThanOrEqual(50);
  const accounts = () => db.query<{ id: string; current_rating: string; total_matches: number; wins: number; losses: number; total_points_for: number; total_points_against: number }>(
    'SELECT id,current_rating,total_matches,wins,losses,total_points_for,total_points_against FROM profiles ORDER BY id');
  const snapshots = () => db.query<{ id: string; rating_before: string | null; rating_after: string | null; rating_change: string | null }>(
    'SELECT mp.id,mp.rating_before,mp.rating_after,mp.rating_change FROM match_participants mp JOIN matches m ON m.id=mp.match_id WHERE NOT m.voided ORDER BY mp.id');
  const before = await accounts(), ratingsBefore = await snapshots();
  await db.exec('SELECT recalculate_all_ratings()');
  const after = await accounts(), ratingsAfter = await snapshots();
  expect(after.rows).toHaveLength(before.rows.length);
  for (const [i, account] of after.rows.entries()) {
    const previous = before.rows[i];
    expect({ ...account, current_rating: undefined }).toEqual({ ...previous, current_rating: undefined });
    expect(Number(account.current_rating)).toBeCloseTo(Number(previous.current_rating), 8);
  }
  expect(ratingsAfter.rows).toHaveLength(ratingsBefore.rows.length);
  for (const [i, row] of ratingsAfter.rows.entries()) {
    expect(row.id).toBe(ratingsBefore.rows[i].id);
    for (const field of ['rating_before', 'rating_after', 'rating_change'] as const) {
      const previous = ratingsBefore.rows[i][field];
      if (previous == null) expect(row[field]).toBeNull();
      else expect(Number(row[field])).toBeCloseTo(Number(previous), 8);
    }
  }
  const totals = (await db.query<{ completed: number; matches: number; participants: number }>(`SELECT
    (SELECT count(*)::int FROM round_robin_events WHERE status='completed') completed,
    (SELECT count(*)::int FROM matches WHERE NOT voided) matches,
    (SELECT count(*)::int FROM match_participants mp JOIN matches m ON m.id=mp.match_id WHERE NOT m.voided) participants`)).rows[0];
  expect(totals).toEqual({ completed: scenarios.length, matches: results.reduce((n, r) => n + r.scoredMatches, 0), participants: results.reduce((n, r) => n + r.participantResults, 0) });
  finalReconciliation = 'passed';
}, 120_000);
