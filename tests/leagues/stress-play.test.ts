import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import {
  leagueActor,
  leagueSimulationDatabase,
} from "../helpers/leagueSimulationDatabase";
import {
  leagueEdgeHandler,
  leagueSimulationClient,
} from "../helpers/leagueSimulationClient";
import {
  computePlayerStandings,
  computeTeamStandings,
} from "@/lib/leagues/standings";
import type { LeagueMatch, LeagueTeam } from "@/lib/leagues/types";

const id = (n: number) =>
  `71000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const owner = id(1),
  manager = id(2),
  outsider = id(3);
const players = Array.from({ length: 68 }, (_, index) => id(index + 100));
let db: PGlite;
let first: Awaited<ReturnType<typeof leagueEdgeHandler>>,
  next: typeof first,
  finalize: typeof first,
  advance: typeof first;
const timings = new Map<string, number[]>();
async function timed<T>(name: string, work: () => Promise<T>): Promise<T> {
  const start = performance.now();
  try {
    return await work();
  } finally {
    timings.set(name, [
      ...(timings.get(name) ?? []),
      performance.now() - start,
    ]);
  }
}
const actor = (user = manager) => leagueActor(db, user);
async function rpc(user: string, name: string, args: Record<string, unknown>) {
  return timed(name, async () => {
    const result = await leagueSimulationClient(db, user).rpc(name, args);
    if (result.error) throw new Error(result.error.message);
    return result.data as any;
  });
}
// PostgREST serializes timestamps; use the same boundary for presentation math.
const rows = async <T = any>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> =>
  JSON.parse(JSON.stringify((await db.query<T>(sql, params)).rows));
const games = (batch: string) =>
  rows<LeagueMatch & { ladder_game_number: number }>(
    "SELECT m.* FROM league_matches m JOIN ladder_batch_groups g ON g.id=m.ladder_batch_group_id WHERE g.batch_id=$1 ORDER BY g.group_index,m.ladder_game_number",
    [batch]
  );
const slots = (game: LeagueMatch) =>
  [
    game.player_a_id,
    game.player_b_id,
    game.player_c_id,
    game.player_d_id,
  ] as string[];
const score = (game: LeagueMatch, user = manager) =>
  rpc(user, "submit_league_match_score", {
    p_match_id: game.id,
    p_team_a_score: 11,
    p_team_b_score: [3, 6, 8][(game as any).ladder_game_number - 1] ?? 7,
  });
async function seed(
  count = 8,
  courts = 2,
  type = "ladder",
  leagueOwner = owner
) {
  const league = await rpc(leagueOwner, "create_league", {
    p_name: "Isolated league stress test",
    p_league_type: type,
  });
  await actor(leagueOwner)(
    "UPDATE leagues SET status='active',rating_eligible=true WHERE id=$1",
    [league]
  );
  const season = (
    await actor(leagueOwner)<{ id: string }>(
      "INSERT INTO league_seasons(league_id,name,status,start_date,end_date) VALUES($1,'Stress season','active','2027-01-01','2027-03-01') RETURNING id",
      [league]
    )
  ).rows[0].id;
  await actor(leagueOwner)(
    "INSERT INTO league_members(league_id,season_id,user_id,role) VALUES($1,$2,$3,'manager')",
    [league, season, manager]
  );
  const roster = players.slice(0, count);
  await actor(leagueOwner)(
    "INSERT INTO league_members(league_id,season_id,user_id) SELECT $1,$2,unnest($3::uuid[])",
    [league, season, roster]
  );
  if (type === "ladder")
    await actor()(
      "INSERT INTO ladder_settings(league_id,season_id,batches_per_week,total_weeks,court_count,auto_advance,self_report_scoring) VALUES($1,$2,2,5,$3,false,false)",
      [league, season, courts]
    );
  const sessions: string[] = [];
  for (let week = 1; week <= 5; week++) {
    const result = await rpc(manager, "schedule_ladder_week", {
      p_league_id: league,
      p_season_id: season,
      p_week_number: week,
      p_scheduled_date: `2027-01-${String(week * 5).padStart(2, "0")}`,
      p_start_time: "00:00",
      p_end_time: "23:59",
      p_court_count: courts,
      p_capacity: count,
    });
    sessions.push(result.session_id);
  }
  return { league, season, roster, sessions };
}
async function start(fixture: Awaited<ReturnType<typeof seed>>) {
  const result = await timed("generate_first", () =>
    first(manager, {
      season_id: fixture.season,
      session_id: fixture.sessions[0],
      order: fixture.roster,
    })
  );
  expect(result.body, JSON.stringify(result)).toMatchObject({ success: true });
  return String(result.body.first_batch_id);
}
async function process(batch: string) {
  const result = await timed("process_batch", () =>
    finalize(manager, { batch_id: batch })
  );
  expect(result.body, JSON.stringify(result)).toMatchObject({ success: true });
  return result;
}

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2027-01-30T19:00:00Z"));
  db = await leagueSimulationDatabase();
  [first, next, finalize, advance] = await Promise.all(
    [
      "ladder-generate-first-batch",
      "ladder-generate-next",
      "ladder-finalize-batch",
      "ladder-advance",
    ].map((name) => leagueEdgeHandler(db, name))
  );
  for (const [index, user] of [
    owner,
    manager,
    outsider,
    ...players,
  ].entries()) {
    await db.query(
      "INSERT INTO profiles(id,display_name,first_name,last_name) VALUES($1,$2,'Stress',$3)",
      [user, `Stress Player ${index}`, `Player ${index}`]
    );
  }
}, 60_000);
beforeEach(async () => {
  await db.exec(
    "TRUNCATE leagues CASCADE; TRUNCATE matches CASCADE; TRUNCATE notifications;"
  );
});
afterAll(async () => {
  console.info(
    "League stress timings (isolated SQL + edge handlers, no network/rating engine):",
    JSON.stringify(
      Object.fromEntries(
        [...timings].map(([name, values]) => {
          const sorted = values.toSorted((a, b) => a - b);
          return [
            name,
            {
              count: values.length,
              p50Ms: Math.round(sorted[Math.floor(sorted.length * 0.5)]),
              p95Ms: Math.round(
                sorted[
                  Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))
                ]
              ),
              maxMs: Math.round(sorted.at(-1)!),
            },
          ];
        })
      )
    )
  );
  await db?.close();
  vi.useRealTimers();
});

describe("league play stress scenarios", () => {
  it.each([
    [4, 1],
    [20, 2],
    [64, 4],
  ])(
    "completes five weeks with %i players on %i courts, preserving every game and standing",
    async (count, courts) => {
      const fixture = await seed(count, courts);
      let batch = await start(fixture);
      for (let stage = 0; stage < 10; stage++) {
        const draw = await games(batch);
        const groups = await rows(
          "SELECT * FROM ladder_batch_groups WHERE batch_id=$1",
          [batch]
        );
        expect(draw).toHaveLength((count / 4) * 3);
        expect(
          new Set(groups.map((g) => `${g.wave}:${g.court_number}`)).size
        ).toBe(count / 4);
        expect(
          groups.every((g) => g.court_number >= 1 && g.court_number <= courts)
        ).toBe(true);
        for (const player of fixture.roster) {
          const own = draw.filter((game) => slots(game).includes(player));
          expect(own).toHaveLength(3);
          const partners = own.map((game) => {
            const p = slots(game);
            return p[p.indexOf(player) ^ 1];
          });
          expect(new Set(partners).size).toBe(3);
        }
        for (const game of draw) {
          await score(game, game.player_a_id!);
          await rpc(game.player_c_id!, "confirm_league_match_score", {
            p_match_id: game.id,
            p_team_a_score: 11,
            p_team_b_score: [3, 6, 8][game.ladder_game_number - 1],
          });
        }
        await process(batch);
        const snapshot = (
          await rows(
            "SELECT s.player_ids FROM ladder_batches b JOIN ladder_snapshots s ON s.id=b.result_snapshot_id WHERE b.id=$1",
            [batch]
          )
        )[0].player_ids;
        expect([...snapshot].sort()).toEqual([...fixture.roster].sort());
        if (stage < 9) {
          const result = await timed("generate_next", () =>
            next(manager, {
              season_id: fixture.season,
              session_id: fixture.sessions[Math.floor((stage + 1) / 2)],
            })
          );
          expect(result.body, JSON.stringify(result)).toMatchObject({
            success: true,
          });
          batch = result.body.batch_id;
        }
      }
      const recorded = await rows<LeagueMatch>(
        "SELECT * FROM league_matches WHERE season_id=$1",
        [fixture.season]
      );
      expect(recorded).toHaveLength((count / 4) * 30);
      expect(
        recorded.every(
          (game) => game.status === "verified" && game.linked_match_id
        )
      ).toBe(true);
      const standings = computePlayerStandings(recorded, (user) => user);
      expect(standings).toHaveLength(count);
      expect(standings.every((row) => row.gamesPlayed === 30)).toBe(true);
      expect(standings.reduce((sum, row) => sum + row.wins, 0)).toBe(
        count * 15
      );
      expect(
        (await rows("SELECT count(*)::int AS n FROM match_participants"))[0].n
      ).toBe(count * 30);
      expect(
        (await next(manager, { season_id: fixture.season })).body.done
      ).toBe(true);
      await actor()(
        "UPDATE league_seasons SET status='completed' WHERE id=$1",
        [fixture.season]
      );
      expect(
        (
          await rows(
            "SELECT status,auto_advance FROM ladder_settings WHERE season_id=$1",
            [fixture.season]
          )
        )[0]
      ).toEqual({ status: "complete", auto_advance: false });
    },
    120_000
  );

  it("survives bursts of repeated starts, confirmations, processing, and next-round requests without duplicates", async () => {
    const fixture = await seed();
    const starts = await Promise.all(
      Array.from({ length: 8 }, () =>
        first(manager, {
          season_id: fixture.season,
          session_id: fixture.sessions[0],
          order: fixture.roster,
        })
      )
    );
    expect(starts.every((result) => result.status === 200)).toBe(true);
    const batches = await rows("SELECT id FROM ladder_batches");
    expect(batches).toHaveLength(1);
    const batch = batches[0].id;
    for (const game of await games(batch)) {
      await score(game, game.player_a_id!);
      await Promise.all(
        Array.from({ length: 8 }, () =>
          rpc(game.player_c_id!, "confirm_league_match_score", {
            p_match_id: game.id,
            p_team_a_score: 11,
            p_team_b_score: [3, 6, 8][game.ladder_game_number - 1],
          })
        )
      );
    }
    expect(await rows("SELECT id FROM matches")).toHaveLength(6);
    const processed = await Promise.all(
      Array.from({ length: 8 }, () => finalize(manager, { batch_id: batch }))
    );
    expect(processed.every((result) => result.status === 200)).toBe(true);
    expect(
      await rows("SELECT id FROM ladder_snapshots WHERE kind='batch_result'")
    ).toHaveLength(1);
    expect(await rows("SELECT id FROM ladder_movements")).toHaveLength(8);
    const generated = await Promise.all(
      Array.from({ length: 8 }, () =>
        next(manager, { season_id: fixture.season })
      )
    );
    expect(generated.every((result) => result.status < 500)).toBe(true);
    expect(await rows("SELECT id FROM ladder_batches")).toHaveLength(2);
    expect(await rows("SELECT id FROM league_matches")).toHaveLength(12);
  }, 60_000);

  it("protects played downstream results, then permits an explicit correction and clean regeneration", async () => {
    const fixture = await seed();
    const batch = await start(fixture);
    const original = await games(batch);
    for (const game of original) await score(game);
    await process(batch);
    const generated = await next(manager, { season_id: fixture.season });
    const downstream = await games(generated.body.batch_id);
    await score(downstream[0]);
    await expect(
      rpc(manager, "ladder_reopen_batch", { p_batch_id: batch })
    ).rejects.toThrow("already-played");
    expect(await rows("SELECT id FROM matches")).toHaveLength(7);
    expect(
      (await rows("SELECT status FROM ladder_batches WHERE id=$1", [batch]))[0]
        .status
    ).toBe("finalized");
    const result = await rpc(manager, "ladder_reopen_batch", {
      p_batch_id: batch,
      p_force: true,
    });
    expect(result).toMatchObject({
      downstream_batches_removed: 1,
      downstream_played_games_discarded: 1,
      rating_rows_removed: 1,
    });
    expect(await rows("SELECT id FROM matches")).toHaveLength(6);
    expect(await rows("SELECT id FROM match_participants")).toHaveLength(24);
    await actor()(
      "UPDATE league_matches SET team_a_score=4,team_b_score=11 WHERE id=$1",
      [original[0].id]
    );
    expect(
      (
        await rows(
          "SELECT team1_score,team2_score FROM matches WHERE id=(SELECT linked_match_id FROM league_matches WHERE id=$1)",
          [original[0].id]
        )
      )[0]
    ).toEqual({ team1_score: 4, team2_score: 11 });
    await process(batch);
    expect(
      (await next(manager, { season_id: fixture.season })).body.success
    ).toBe(true);
    expect(await rows("SELECT id FROM league_matches")).toHaveLength(12);
    expect(await rows("SELECT id FROM matches")).toHaveLength(6);
  });

  it("refuses score changes to a processed round until it is reopened", async () => {
    const fixture = await seed();
    const batch = await start(fixture);
    const draw = await games(batch);
    for (const game of draw) await score(game);
    await process(batch);
    await expect(
      actor()(
        "UPDATE league_matches SET team_a_score=4,team_b_score=11 WHERE id=$1",
        [draw[0].id]
      )
    ).rejects.toThrow(/reopen/i);
    await expect(
      actor()("UPDATE league_matches SET status='scheduled' WHERE id=$1", [
        draw[0].id,
      ])
    ).rejects.toThrow(/reopen/i);
    await expect(
      actor()("DELETE FROM league_matches WHERE id=$1", [draw[0].id])
    ).rejects.toThrow(/reopen/i);
    expect((await games(batch))[0].team_a_score).toBe(11);
  });

  it("reopening pauses automatic progression and clears resolved tiebreaks before corrections", async () => {
    const fixture = await seed();
    const batch = await start(fixture);
    await actor()(
      "UPDATE ladder_settings SET auto_advance=true WHERE season_id=$1",
      [fixture.season]
    );
    for (const game of await games(batch))
      await rpc(manager, "submit_league_match_score", {
        p_match_id: game.id,
        p_team_a_score: 11,
        p_team_b_score: 7,
      });
    expect(
      (await advance(players[0], { season_id: fixture.season })).body.skipped
    ).toBe("tiebreak_required");
    for (const tie of await rows(
      "SELECT * FROM ladder_tiebreaks WHERE batch_id=$1",
      [batch]
    )) {
      await rpc(manager, "record_ladder_tiebreak", {
        p_group_id: tie.group_id,
        p_ordered_ids: [...tie.tied_player_ids].reverse(),
      });
    }
    expect(
      (await advance(players[0], { season_id: fixture.season })).body.advanced
    ).toBe(true);
    await rpc(manager, "ladder_reopen_batch", { p_batch_id: batch });
    expect(
      (
        await rows(
          "SELECT auto_advance FROM ladder_settings WHERE season_id=$1",
          [fixture.season]
        )
      )[0].auto_advance
    ).toBe(false);
    expect(
      await rows("SELECT id FROM ladder_tiebreaks WHERE batch_id=$1", [batch])
    ).toHaveLength(0);
    expect(
      (await advance(players[0], { season_id: fixture.season })).body.skipped
    ).toBe("auto_advance_off");
    expect(
      (await rows("SELECT status FROM ladder_batches WHERE id=$1", [batch]))[0]
        .status
    ).toBe("in_progress");
    expect((await finalize(manager, { batch_id: batch })).body.error).toBe(
      "tiebreak_required"
    );
  });

  it("rejects invalid rosters and foreign sessions without partial draws, and blocks unfinished advancement", async () => {
    const fixture = await seed(8, 1),
      other = await seed(8, 1, "ladder", players[67]);
    for (const roster of [
      fixture.roster.slice(0, 7),
      [...fixture.roster.slice(0, 7), fixture.roster[0]],
    ]) {
      expect(
        (
          await first(manager, {
            season_id: fixture.season,
            session_id: fixture.sessions[0],
            order: roster,
          })
        ).status
      ).toBe(400);
    }
    expect(
      (
        await first(manager, {
          season_id: fixture.season,
          session_id: other.sessions[0],
          order: fixture.roster,
        })
      ).status
    ).toBe(400);
    expect(await rows("SELECT id FROM ladder_batches")).toHaveLength(0);
    expect(await rows("SELECT id FROM ladder_snapshots")).toHaveLength(0);
    const batch = await start(fixture);
    expect((await finalize(manager, { batch_id: batch })).body.error).toBe(
      "batch_incomplete"
    );
    expect(
      (await next(manager, { season_id: fixture.season })).body.error
    ).toBe("current_stage_not_processed");
    const game = (await games(batch))[0];
    await expect(score(game, outsider)).rejects.toThrow(/participants/);
    await expect(
      rpc(outsider, "ladder_reopen_batch", { p_batch_id: batch })
    ).rejects.toThrow(/privileges/);
    expect(
      (await leagueActor(db, outsider)("SELECT id FROM league_matches")).rows
    ).toHaveLength(0);
    expect(
      (await advance(outsider, { season_id: fixture.season })).body.skipped
    ).toBe("auto_advance_off");
    expect(await rows("SELECT id FROM ladder_batches")).toHaveLength(1);
  });

  it("runs team scoring, dispute resolution, forfeits, and completion with coherent standings", async () => {
    const fixture = await seed(8, 2, "team");
    const teams: LeagueTeam[] = [];
    for (let i = 0; i < 4; i++) {
      const team = (
        await actor()<LeagueTeam>(
          "INSERT INTO league_teams(league_id,season_id,name,captain_user_id) VALUES($1,$2,$3,$4) RETURNING *",
          [
            fixture.league,
            fixture.season,
            `Team ${i + 1}`,
            fixture.roster[i * 2],
          ]
        )
      ).rows[0];
      teams.push(team);
      for (const user of fixture.roster.slice(i * 2, i * 2 + 2))
        await actor()(
          "INSERT INTO league_team_members(team_id,user_id) VALUES($1,$2)",
          [team.id, user]
        );
    }
    const draw: LeagueMatch[] = [];
    for (let a = 0; a < 4; a++)
      for (let b = a + 1; b < 4; b++)
        draw.push(
          (
            await actor()<LeagueMatch>(
              "INSERT INTO league_matches(league_id,season_id,session_id,team_a_id,team_b_id,court_number) VALUES($1,$2,$3,$4,$5,1) RETURNING *",
              [
                fixture.league,
                fixture.season,
                fixture.sessions[0],
                teams[a].id,
                teams[b].id,
              ]
            )
          ).rows[0]
        );
    await expect(
      actor()("UPDATE league_seasons SET status='completed' WHERE id=$1", [
        fixture.season,
      ])
    ).rejects.toThrow(/open matches/);
    await score(draw[0], teams[0].captain_user_id!);
    await rpc(teams[1].captain_user_id!, "dispute_league_match", {
      p_match_id: draw[0].id,
      p_reason: "Incorrect score",
    });
    await rpc(manager, "resolve_league_match_dispute", {
      p_match_id: draw[0].id,
      p_team_a_score: 9,
      p_team_b_score: 11,
      p_note: "Reviewed by manager",
    });
    await rpc(teams[0].captain_user_id!, "forfeit_league_match", {
      p_match_id: draw[1].id,
      p_reason: "Cannot attend",
    });
    for (const game of draw.slice(2)) await score(game);
    const saved = await rows<LeagueMatch>(
      "SELECT * FROM league_matches WHERE season_id=$1",
      [fixture.season]
    );
    const standings = computeTeamStandings(saved, teams);
    expect(standings).toHaveLength(4);
    expect(standings.every((row) => row.gamesPlayed === 3)).toBe(true);
    expect(standings.reduce((sum, row) => sum + row.wins, 0)).toBe(6);
    expect(standings.reduce((sum, row) => sum + row.forfeitWins, 0)).toBe(1);
    expect(saved.find((game) => game.id === draw[1].id)).toMatchObject({
      status: "forfeit",
      forfeit_winner_team_id: teams[2].id,
      team_a_score: null,
      team_b_score: null,
    });
    await actor()("UPDATE league_sessions SET status='completed' WHERE id=$1", [
      fixture.sessions[0],
    ]);
    await actor()("UPDATE league_seasons SET status='completed' WHERE id=$1", [
      fixture.season,
    ]);
  });
});
