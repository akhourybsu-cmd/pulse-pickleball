import type { PGlite } from "@electric-sql/pglite";
import { leagueActor } from "./leagueSimulationDatabase";
import {
  leagueEdgeHandler,
  leagueSimulationClient,
} from "./leagueSimulationClient";

export async function seedLeagueBrowserSimulation(db: PGlite) {
  const uuid = (n: number) =>
    `60000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
  const users = [
    "Morgan Host",
    "Jordan Manager",
    "Avery Lane",
    "Blake Rivera",
    "Cameron Lee",
    "Devon Cruz",
    "Elliot Reed",
    "Finley Brooks",
    "Gray Morgan",
    "Harper Quinn",
    "Skye Parker",
    "Taylor Reed",
    "Riley Chen",
    "Rowan Ellis",
  ].map((name, index) => ({ id: uuid(index + 1), name }));
  for (const user of users)
    await db.query(
      "INSERT INTO profiles(id,display_name,full_name,first_name,last_name) VALUES($1,$2,$2,$3,$4)",
      [user.id, user.name, user.name.split(" ")[0], user.name.split(" ")[1]]
    );
  const owner = users[0].id,
    manager = users[1].id,
    players = users.slice(2, 10).map((user) => user.id);
  const rpc = async (
    user: string,
    name: string,
    args: Record<string, unknown>
  ) => {
    const result = await leagueSimulationClient(db, user).rpc(name, args);
    if (result.error) throw new Error(`${name}: ${result.error.message}`);
    return result.data;
  };
  const league = await rpc(owner, "create_league", {
    p_name: "Five-week ladder · isolated QA",
    p_league_type: "ladder",
  });
  const actor = leagueActor(db, owner);
  await actor("UPDATE leagues SET status='active' WHERE id=$1", [league]);
  const season = (
    await actor<any>(
      "INSERT INTO league_seasons(league_id,name,status,start_date,end_date,registration_deadline) VALUES($1,'Five-week rotation','active',CURRENT_DATE-7,CURRENT_DATE+28,CURRENT_DATE+28) RETURNING id",
      [league]
    )
  ).rows[0].id;
  await actor(
    "INSERT INTO league_members(league_id,season_id,user_id,role) VALUES($1,$2,$3,'manager')",
    [league, season, manager]
  );
  for (const user of players)
    await actor(
      "INSERT INTO league_members(league_id,season_id,user_id) VALUES($1,$2,$3)",
      [league, season, user]
    );
  for (const user of users.slice(10))
    await actor(
      "INSERT INTO league_substitutes(league_id,season_id,user_id,notes) VALUES($1,$2,$3,$4)",
      [league, season, user.id, "Available for evening play"]
    );
  await actor(
    "INSERT INTO ladder_settings(league_id,season_id,batches_per_week,court_count,total_weeks) VALUES($1,$2,2,2,5)",
    [league, season]
  );
  const today = new Date();
  today.setUTCHours(12, 0, 0, 0);
  const sessions: string[] = [];
  for (let week = 1; week <= 5; week++) {
    const date = new Date(today.getTime() + (week - 2) * 7 * 86400000)
      .toISOString()
      .slice(0, 10);
    const scheduled = await rpc(manager, "schedule_ladder_week", {
      p_league_id: league,
      p_season_id: season,
      p_week_number: week,
      p_scheduled_date: date,
      p_start_time: "00:00",
      p_end_time: "23:59",
      p_court_count: 2,
      p_capacity: 8,
    });
    sessions.push(scheduled.session_id);
  }
  const handlers = Object.fromEntries(
    await Promise.all(
      [
        "ladder-generate-first-batch",
        "ladder-generate-next",
        "ladder-finalize-batch",
        "ladder-advance",
      ].map(async (name) => [name, await leagueEdgeHandler(db, name)])
    )
  );
  await handlers["ladder-generate-first-batch"](manager, {
    season_id: season,
    session_id: sessions[0],
    order: players,
  });
  for (let batch = 1; batch <= 2; batch++) {
    const current = (
      await db.query<any>(
        "SELECT id FROM ladder_batches WHERE season_id=$1 AND week_number=1 AND batch_number=$2",
        [season, batch]
      )
    ).rows[0].id;
    const games = (
      await db.query<any>(
        "SELECT m.* FROM league_matches m JOIN ladder_batch_groups g ON g.id=m.ladder_batch_group_id WHERE g.batch_id=$1",
        [current]
      )
    ).rows;
    await rpc(manager, "admin_score_ladder_batch", {
      p_batch_id: current,
      p_scores: games.map((m) => ({
        id: m.id,
        a: 11,
        b: [3, 6, 8][m.ladder_game_number - 1],
      })),
    });
    const outcome = await handlers["ladder-finalize-batch"](manager, {
      batch_id: current,
    });
    if (outcome.body.error) throw new Error(JSON.stringify(outcome.body));
    if (batch === 1)
      await handlers["ladder-generate-next"](manager, { season_id: season });
  }
  const request = await rpc(players[0], "request_ladder_sub", {
    p_season_id: season,
    p_session_id: sessions[1],
    p_note: "Away this week",
  });
  await rpc(manager, "resolve_ladder_sub_request", {
    p_request_id: request.request_id,
    p_resolution: "sub",
    p_assigned_sub_id: users[10].id,
  });
  await handlers["ladder-generate-next"](manager, {
    season_id: season,
    session_id: sessions[1],
  });
  await rpc(players[1], "request_ladder_sub", {
    p_season_id: season,
    p_session_id: sessions[2],
    p_note: "Out of town for Week 3",
  });
  return { league, season, users, handlers };
}
