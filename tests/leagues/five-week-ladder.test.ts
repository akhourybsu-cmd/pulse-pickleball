import { beforeAll, afterAll, expect, it, vi } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import {
  leagueSimulationDatabase,
  leagueActor,
} from "../helpers/leagueSimulationDatabase";
import {
  leagueSimulationClient,
  leagueEdgeHandler,
} from "../helpers/leagueSimulationClient";
import { computePlayerStandings } from "@/lib/leagues/standings";
import {
  computeBatchOutcome,
  excludeSitouts,
  reinsertSitouts,
} from "@/lib/leagues/ladder";
import type { LeagueMatch } from "@/lib/leagues/types";

const id = (n: number) =>
  `50000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const owner = id(1),
  manager = id(2),
  outsider = id(3),
  replacement = id(4);
const players = Array.from({ length: 16 }, (_, i) => id(i + 100));
const subs = Array.from({ length: 4 }, (_, i) => id(i + 200));
const firstDay = Date.parse("2027-01-04T19:00:00Z");
let db: PGlite, league: string, season: string;
let first: Awaited<ReturnType<typeof leagueEdgeHandler>>,
  next: typeof first,
  finalize: typeof first,
  advance: typeof first;
const weeks: string[] = [];
const report: {
  week: number;
  games: number;
  coveredSlots: number;
  ladderPlayers: number;
}[] = [];
const as = (user: string) => leagueActor(db, user);
const rpc = async (
  user: string,
  name: string,
  args: Record<string, unknown> = {}
) => {
  const result = await leagueSimulationClient(db, user).rpc(name, args);
  if (result.error) throw new Error(`${name}: ${result.error.message}`);
  return result.data as any;
};
const setWeek = (week: number) =>
  vi.setSystemTime(new Date(firstDay + (week - 1) * 7 * 86400000));
const batchRow = async (week: number, batch: number) =>
  (
    await db.query<any>(
      "SELECT * FROM ladder_batches WHERE season_id=$1 AND week_number=$2 AND batch_number=$3",
      [season, week, batch]
    )
  ).rows[0];
const games = async (batch: string) =>
  (
    await db.query<any>(
      "SELECT m.* FROM league_matches m JOIN ladder_batch_groups g ON g.id=m.ladder_batch_group_id WHERE g.batch_id=$1 ORDER BY g.group_index,m.ladder_game_number",
      [batch]
    )
  ).rows;
const playerSlots = (game: any) =>
  [
    game.player_a_id,
    game.player_b_id,
    game.player_c_id,
    game.player_d_id,
  ] as string[];
const request = (player: string, week: number) =>
  rpc(player, "request_ladder_sub", {
    p_season_id: season,
    p_session_id: weeks[week - 1],
    p_note: "Away for this week",
  });
const resolveSub = (
  requestId: string,
  action: string,
  sub: string | null = null
) =>
  rpc(manager, "resolve_ladder_sub_request", {
    p_request_id: requestId,
    p_resolution: action,
    p_assigned_sub_id: sub,
    p_note: "Arranged by the manager",
  });

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  setWeek(1);
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
    replacement,
    ...players,
    ...subs,
  ].entries()) {
    await db.query(
      "INSERT INTO profiles(id,display_name,full_name,first_name,last_name) VALUES($1,$2,$2,$3,$4)",
      [user, `Simulation Player ${index}`, "Simulation", `Player ${index}`]
    );
  }
}, 60_000);
afterAll(async () => {
  await db?.close();
  vi.useRealTimers();
});

it("runs all five weeks through the real player RPCs, manager RPCs, edge handlers, RLS and triggers", async () => {
  expect(
    String((await db.query("SELECT CURRENT_DATE::text AS day")).rows[0].day)
  ).toBe("2027-01-04");
  league = await rpc(owner, "create_league", {
    p_name: "Isolated five-week ladder",
    p_league_type: "ladder",
  });
  await as(owner)(
    "UPDATE leagues SET status='active',rating_eligible=true WHERE id=$1",
    [league]
  );
  season = (
    await as(owner)<any>(
      "INSERT INTO league_seasons(league_id,name,status,start_date,end_date,registration_deadline) VALUES($1,'Five weeks','active','2027-01-04','2027-02-02','2027-01-04') RETURNING id",
      [league]
    )
  ).rows[0].id;
  await as(owner)(
    "INSERT INTO league_members(league_id,season_id,user_id,role,status) VALUES($1,$2,$3,'manager','active')",
    [league, season, manager]
  );
  const code = (
    await db.query<any>("SELECT invite_code FROM leagues WHERE id=$1", [league])
  ).rows[0].invite_code;
  for (const user of players)
    await rpc(user, "join_league_by_code", {
      p_code: ` ${code.toLowerCase()} `,
    });
  await rpc(players[0], "join_league_by_code", { p_code: code });
  expect(
    (
      await db.query(
        "SELECT id FROM league_members WHERE season_id=$1 AND role='player'",
        [season]
      )
    ).rows
  ).toHaveLength(16);
  expect(
    (await as(outsider)("SELECT id FROM leagues WHERE id=$1", [league])).rows
  ).toHaveLength(0);
  expect(
    (
      await as(players[0])(
        "UPDATE league_members SET role='manager' WHERE user_id=$1 RETURNING id",
        [players[0]]
      )
    ).rows
  ).toHaveLength(0);
  for (const sub of subs)
    await as(manager)(
      "INSERT INTO league_substitutes(league_id,season_id,user_id,notes) VALUES($1,$2,$3,'Available evenings')",
      [league, season, sub]
    );
  await as(manager)(
    "UPDATE league_substitutes SET status='inactive',notes='Unavailable this week' WHERE user_id=$1",
    [subs[3]]
  );
  expect(
    (
      await as(players[0])(
        "UPDATE league_substitutes SET status='active' WHERE user_id=$1 RETURNING id",
        [subs[3]]
      )
    ).rows
  ).toHaveLength(0);
  await as(manager)(
    "INSERT INTO ladder_settings(league_id,season_id,batches_per_week,total_weeks,court_count,auto_advance,self_report_scoring) VALUES($1,$2,2,5,2,false,false)",
    [league, season]
  );
  for (let week = 1; week <= 5; week++) {
    const date = new Date(firstDay + (week - 1) * 7 * 86400000)
      .toISOString()
      .slice(0, 10);
    const scheduled = await rpc(manager, "schedule_ladder_week", {
      p_league_id: league,
      p_season_id: season,
      p_week_number: week,
      p_scheduled_date: date,
      p_start_time: "18:00",
      p_end_time: "21:00",
      p_location: "Simulation courts",
      p_court_count: 2,
      p_capacity: 16,
    });
    weeks.push(scheduled.session_id);
  }
  expect(weeks.every(Boolean)).toBe(true);
  expect(
    (
      await first(players[0], {
        season_id: season,
        order: players,
        session_id: weeks[0],
      })
    ).status
  ).toBe(400);
  const opening = await first(manager, {
    season_id: season,
    order: players,
    session_id: weeks[0],
  });
  expect(opening.body, JSON.stringify(opening)).toMatchObject({
    success: true,
  });
  await first(manager, {
    season_id: season,
    order: players,
    session_id: weeks[0],
  });
  expect((await db.query("SELECT id FROM ladder_batches")).rows).toHaveLength(
    1
  );

  const covered = await request(players[0], 2);
  await expect(resolveSub(covered.request_id, "sub", subs[3])).rejects.toThrow(
    "active substitute"
  );
  await resolveSub(covered.request_id, "sub", subs[0]);
  const another = await request(players[1], 2);
  await expect(resolveSub(another.request_id, "sub", subs[0])).rejects.toThrow(
    "already covering"
  );
  await resolveSub(another.request_id, "declined");
  await request(players[1], 2);
  await resolveSub(another.request_id, "sitout");
  await rpc(manager, "reopen_ladder_sub_request", {
    p_request_id: another.request_id,
  });
  await resolveSub(another.request_id, "sub", subs[1]);
  const canceled = await request(players[2], 2);
  await rpc(players[2], "cancel_ladder_sub_request", {
    p_request_id: canceled.request_id,
  });
  const sitting = players.slice(4, 8);
  for (const player of sitting) {
    const req = await request(player, 3);
    await resolveSub(req.request_id, "sitout");
  }
  const autoCoverage = await request(players[8], 5);
  await resolveSub(autoCoverage.request_id, "sub", subs[2]);
  expect(
    (
      await as(manager)(
        "SELECT * FROM ladder_sub_requests WHERE status='pending'"
      )
    ).rows
  ).toHaveLength(0);
  const requestNotifications = (
    await db.query<any>(
      "SELECT * FROM notifications WHERE kind='league_sub_request'"
    )
  ).rows;
  expect(new Set(requestNotifications.map((row) => row.recipient))).toEqual(
    new Set([owner, manager])
  );
  expect(
    requestNotifications.every((row) =>
      row.link.includes(`tab=actions&season=${season}`)
    )
  ).toBe(true);

  for (let week = 1; week <= 5; week++) {
    setWeek(week);
    if (week === 4) {
      await as(manager)(
        "INSERT INTO league_members(league_id,season_id,user_id,role,status) VALUES($1,$2,$3,'player','active')",
        [league, season, replacement]
      );
      await expect(
        rpc(players[3], "ladder_replace_player", {
          p_season_id: season,
          p_out_user_id: players[3],
          p_in_user_id: replacement,
        })
      ).rejects.toThrow("privileges");
      await rpc(manager, "ladder_replace_player", {
        p_season_id: season,
        p_out_user_id: players[3],
        p_in_user_id: replacement,
      });
    }
    if (week > 1) {
      if (week === 2) {
        const pending = await request(players[9], 2);
        expect(
          (await next(manager, { season_id: season, session_id: weeks[1] }))
            .body.error
        ).toBe("unresolved_requests");
        await rpc(players[9], "cancel_ladder_sub_request", {
          p_request_id: pending.request_id,
        });
      }
      const generated = await next(manager, {
        season_id: season,
        session_id: weeks[week - 1],
      });
      expect(generated.body, JSON.stringify(generated)).toMatchObject({
        success: true,
        week,
        batch: 1,
      });
      expect(generated.body.sub_seed_errors).toBeUndefined();
    }
    if (week === 5)
      await as(manager)(
        "UPDATE ladder_settings SET auto_advance=true,self_report_scoring=true WHERE season_id=$1",
        [season]
      );
    let weekGames = 0,
      coveredSlots = 0;
    for (let batch = 1; batch <= 2; batch++) {
      const current = await batchRow(week, batch);
      expect(current).toBeDefined();
      const groupRows = (
        await db.query<any>(
          "SELECT * FROM ladder_batch_groups WHERE batch_id=$1 ORDER BY group_index",
          [current.id]
        )
      ).rows;
      expect(groupRows).toHaveLength(week === 3 ? 3 : 4);
      expect(
        groupRows.every(
          (g) =>
            g.court_number >= 1 &&
            g.court_number <= 2 &&
            g.player_ids.length === 4
        )
      ).toBe(true);
      expect(
        (
          await next(manager, {
            season_id: season,
            session_id: weeks[week - 1],
          })
        ).body.error
      ).toBe("current_stage_not_processed");
      await expect(
        rpc(manager, "ladder_replace_player", {
          p_season_id: season,
          p_out_user_id: players[2],
          p_in_user_id: replacement,
        })
      ).rejects.toThrow(/Process|current round/);
      if (week === 4 && batch === 1) {
        await rpc(manager, "swap_league_week_player", {
          p_league_id: league,
          p_season_id: season,
          p_out_player_id: players[2],
          p_in_player_id: subs[0],
          p_note: "Late absence",
          p_batch_id: current.id,
        });
        await rpc(manager, "swap_league_week_player", {
          p_league_id: league,
          p_season_id: season,
          p_out_player_id: subs[0],
          p_in_player_id: subs[2],
          p_note: "Cover changed before play",
          p_batch_id: current.id,
        });
      }
      const draw = await games(current.id);
      expect(draw).toHaveLength(groupRows.length * 3);
      const appearances = new Map<string, number>();
      for (const match of draw)
        for (const user of playerSlots(match))
          appearances.set(user, (appearances.get(user) ?? 0) + 1);
      expect([...appearances.values()].every((count) => count === 3)).toBe(
        true
      );
      if (week === 2) {
        expect(appearances.get(subs[0])).toBe(3);
        expect(appearances.get(subs[1])).toBe(3);
        expect(appearances.has(players[0])).toBe(false);
        expect(appearances.has(players[1])).toBe(false);
        expect(
          (
            await as(subs[0])("SELECT id FROM league_matches WHERE id=$1", [
              draw.find((m) => playerSlots(m).includes(subs[0])).id,
            ])
          ).rows
        ).toHaveLength(1);
      }
      if (week === 3)
        for (const player of sitting)
          expect(appearances.has(player)).toBe(false);
      if (week >= 4) {
        expect(appearances.has(players[3])).toBe(false);
        expect(appearances.get(replacement)).toBe(3);
      }
      if (week === 4 && batch === 1) {
        expect(appearances.get(subs[2])).toBe(3);
        expect(appearances.has(subs[0])).toBe(false);
        const swaps = (
          await db.query<any>(
            "SELECT * FROM league_match_substitutions WHERE match_id=ANY($1)",
            [draw.map((m) => m.id)]
          )
        ).rows;
        expect(
          swaps.every(
            (s) => s.out_player_id === players[2] && s.in_player_id === subs[2]
          )
        ).toBe(true);
      }
      for (let index = 0; index < draw.length; index++) {
        const match = (await games(current.id))[index];
        const a = 11,
          b =
            week >= 4 && batch === 2
              ? 7
              : [3, 6, 8][match.ladder_game_number - 1];
        const submitter = playerSlots(match)[0],
          confirmer = playerSlots(match)[2];
        if (index === 0)
          await expect(
            rpc(outsider, "submit_league_match_score", {
              p_match_id: match.id,
              p_team_a_score: a,
              p_team_b_score: b,
            })
          ).rejects.toThrow("participants");
        if (week === 1 && batch === 1 && index === 0) {
          vi.setSystemTime(new Date("2027-01-04T17:00:00Z"));
          await expect(
            rpc(submitter, "submit_league_match_score", {
              p_match_id: match.id,
              p_team_a_score: a,
              p_team_b_score: b,
            })
          ).rejects.toThrow("scheduled start");
          setWeek(1);
        }
        await rpc(submitter, "submit_league_match_score", {
          p_match_id: match.id,
          p_team_a_score: a,
          p_team_b_score: b,
        });
        if (week < 5) {
          expect(
            (
              await db.query<any>(
                "SELECT status FROM league_matches WHERE id=$1",
                [match.id]
              )
            ).rows[0].status
          ).toBe("score_submitted");
          if (week === 1 && batch === 1 && index === 0) {
            await rpc(confirmer, "dispute_league_match", {
              p_match_id: match.id,
              p_reason: "Please check the score",
            });
            await expect(
              rpc(submitter, "submit_league_match_score", {
                p_match_id: match.id,
                p_team_a_score: a,
                p_team_b_score: b,
              })
            ).rejects.toThrow("organizer");
            await rpc(manager, "submit_league_match_score", {
              p_match_id: match.id,
              p_team_a_score: a,
              p_team_b_score: b,
            });
          } else {
            if (index === 0) {
              await rpc(submitter, "confirm_league_match_score", {
                p_match_id: match.id,
                p_team_a_score: a,
                p_team_b_score: b,
              });
              expect(
                (
                  await db.query<any>(
                    "SELECT status FROM league_matches WHERE id=$1",
                    [match.id]
                  )
                ).rows[0].status
              ).toBe("score_submitted");
              await expect(
                rpc(confirmer, "confirm_league_match_score", {
                  p_match_id: match.id,
                  p_team_a_score: a,
                  p_team_b_score: b + 1,
                })
              ).rejects.toThrow("score changed");
            }
            await rpc(confirmer, "confirm_league_match_score", {
              p_match_id: match.id,
              p_team_a_score: a,
              p_team_b_score: b,
            });
          }
        }
        if (week === 4 && batch === 1 && playerSlots(match).includes(subs[2])) {
          const swapBack = await rpc(manager, "swap_league_week_player", {
            p_league_id: league,
            p_season_id: season,
            p_out_player_id: subs[2],
            p_in_player_id: players[2],
            p_note: "Regular arrived after first game",
            p_batch_id: current.id,
          });
          expect(swapBack.matches_updated).toBe(2);
          const recorded = (await games(current.id)).find(
            (m) => m.id === match.id
          );
          expect(playerSlots(recorded)).toEqual(playerSlots(match));
          expect(recorded.status).toBe("verified");
        }
      }
      const verified = await games(current.id);
      expect(
        verified.every((m) => m.status === "verified" && m.linked_match_id)
      ).toBe(true);
      const before = (
        await db.query<any>(
          "SELECT player_ids FROM ladder_snapshots WHERE id=$1",
          [current.start_snapshot_id]
        )
      ).rows[0].player_ids as string[];
      const swaps = (
        await db.query<any>(
          "SELECT * FROM league_match_substitutions WHERE match_id=ANY($1)",
          [draw.map((m) => m.id)]
        )
      ).rows;
      coveredSlots += swaps.length;
      const rankingId = (match: string, player: string) =>
        swaps.find((s) => s.match_id === match && s.in_player_id === player)
          ?.out_player_id ?? player;
      const present = excludeSitouts(before, week === 3 ? sitting : []);
      const scoredGroups = groupRows.map((g) =>
        verified
          .filter((m) => m.ladder_batch_group_id === g.id)
          .map((m) => ({
            game: m.ladder_game_number,
            sideA: [
              rankingId(m.id, m.player_a_id),
              rankingId(m.id, m.player_b_id),
            ] as [string, string],
            sideB: [
              rankingId(m.id, m.player_c_id),
              rankingId(m.id, m.player_d_id),
            ] as [string, string],
            scoreA: m.team_a_score,
            scoreB: m.team_b_score,
          }))
      );
      const resolutions: Record<number, string[]> = {};
      if (week === 4 && batch === 2) {
        const tied = await finalize(manager, { batch_id: current.id });
        expect(tied.body.error).toBe("tiebreak_required");
        expect((await batchRow(week, batch)).status).not.toBe("finalized");
        for (const tie of tied.body.ties)
          resolutions[tie.group_index] = [...tie.player_ids].reverse();
      }
      if (week === 5 && batch === 2) {
        expect(
          (await advance(players[0], { season_id: season })).body.skipped
        ).toBe("tiebreak_required");
        const ties = (
          await db.query<any>(
            "SELECT * FROM ladder_tiebreaks WHERE batch_id=$1",
            [current.id]
          )
        ).rows;
        expect(ties.length).toBeGreaterThan(0);
        for (const tie of ties) {
          const ordered = [...tie.tied_player_ids].reverse();
          await expect(
            rpc(outsider, "record_ladder_tiebreak", {
              p_group_id: tie.group_id,
              p_ordered_ids: ordered,
            })
          ).rejects.toThrow("Only players on this court");
          const participant = playerSlots(
            verified.find((m) => m.ladder_batch_group_id === tie.group_id)
          )[0];
          await expect(
            rpc(participant, "record_ladder_tiebreak", {
              p_group_id: tie.group_id,
              p_ordered_ids: ordered.slice(1),
            })
          ).rejects.toThrow("exactly the tied players");
          await rpc(participant, "record_ladder_tiebreak", {
            p_group_id: tie.group_id,
            p_ordered_ids: ordered,
          });
          resolutions[groupRows.findIndex((g) => g.id === tie.group_id)] =
            ordered;
        }
      }
      const expected = computeBatchOutcome(present, scoredGroups, resolutions);
      const result =
        week === 5
          ? await advance(players[0], { season_id: season })
          : await finalize(manager, {
              batch_id: current.id,
              tie_resolutions: resolutions,
            });
      expect(result.body.error, JSON.stringify(result)).toBeUndefined();
      const processed = await batchRow(week, batch);
      expect(processed.status).toBe("finalized");
      const after = (
        await db.query<any>(
          "SELECT player_ids FROM ladder_snapshots WHERE id=$1",
          [processed.result_snapshot_id]
        )
      ).rows[0].player_ids;
      expect(after).toEqual(
        week === 3
          ? reinsertSitouts(before, expected.nextOrder, sitting)
          : expected.nextOrder
      );
      expect(new Set(after).size).toBe(16);
      if (week < 5) {
        await finalize(manager, { batch_id: current.id });
        if (batch === 1)
          expect(
            (await next(manager, { season_id: season })).body
          ).toMatchObject({ success: true, week, batch: 2 });
      }
      weekGames += draw.length;
    }
    report.push({ week, games: weekGames, coveredSlots, ladderPlayers: 16 });
  }
  const allGames = (
    await leagueSimulationClient(db, manager)
      .from("league_matches")
      .select("*")
      .eq("season_id", season)
  ).data as LeagueMatch[];
  expect(allGames).toHaveLength(114);
  expect(
    (await db.query("SELECT id FROM ladder_batches WHERE status='finalized'"))
      .rows
  ).toHaveLength(10);
  expect(
    (
      await db.query(
        "SELECT id FROM matches WHERE status='approved' AND NOT voided"
      )
    ).rows
  ).toHaveLength(114);
  expect(
    (await db.query("SELECT id FROM match_participants")).rows
  ).toHaveLength(456);
  const standings = computePlayerStandings(allGames, (user) => user);
  expect(standings.reduce((total, row) => total + row.gamesPlayed, 0)).toBe(
    456
  );
  expect(standings.find((row) => row.teamId === subs[0])?.gamesPlayed).toBe(6);
  expect(standings.find((row) => row.teamId === subs[1])?.gamesPlayed).toBe(6);
  expect(standings.find((row) => row.teamId === subs[2])?.gamesPlayed).toBe(7);
  expect(standings.find((row) => row.teamId === players[3])?.gamesPlayed).toBe(
    18
  );
  expect(standings.find((row) => row.teamId === replacement)?.gamesPlayed).toBe(
    12
  );
  expect((await next(manager, { season_id: season })).body.done).toBe(true);
  await as(manager)(
    "UPDATE league_seasons SET status='completed' WHERE id=$1",
    [season]
  );
  expect(
    (
      await db.query<any>(
        "SELECT status,auto_advance FROM ladder_settings WHERE season_id=$1",
        [season]
      )
    ).rows[0]
  ).toEqual({ status: "complete", auto_advance: false });
  expect((await advance(players[0], { season_id: season })).body.skipped).toBe(
    "auto_advance_off"
  );
  expect(
    (await db.query("SELECT id FROM ladder_batches WHERE week_number>5")).rows
  ).toHaveLength(0);
  const automatedAudit = (
    await db.query<any>(
      "SELECT * FROM league_audit_log WHERE new_value->>'via'='auto_advance'"
    )
  ).rows;
  expect(automatedAudit.length).toBeGreaterThanOrEqual(3);
  expect(automatedAudit.every((row) => row.actor_user_id === owner)).toBe(true);
  console.info("Five-week simulation:", JSON.stringify(report));
}, 120_000);
