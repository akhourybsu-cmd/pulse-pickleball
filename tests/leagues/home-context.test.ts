import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import {
  leagueActor,
  leagueSimulationDatabase,
} from "../helpers/leagueSimulationDatabase";

let db: PGlite, league: string, season: string, session: string, match: string;
const ids = Array.from(
  { length: 6 },
  (_, i) => `70000000-0000-0000-0000-00000000000${i + 1}`
);
const [owner, player, partner, opponent, opponentPartner, outsider] = ids;
const branding = { primary_color: "#2563eb" };
const upcoming = async (user = player, limit: number | null = 3) =>
  (
    await leagueActor(db, user)<Record<string, any>>(
      "SELECT * FROM get_my_upcoming_league_matches($1)",
      [limit]
    )
  ).rows;

beforeAll(async () => {
  db = await leagueSimulationDatabase();
  for (let i = 0; i < ids.length; i++)
    await db.query("INSERT INTO profiles(id,display_name) VALUES($1,$2)", [
      ids[i],
      ["Owner", "Avery", "Blake", "Casey", "Devon", "Outsider"][i],
    ]);
}, 60_000);
afterAll(async () => {
  await db?.close();
});
beforeEach(async () => {
  await db.exec("TRUNCATE leagues,notifications CASCADE");
  league = (
    await leagueActor(
      db,
      owner
    )<{ id: string }>("SELECT create_league('Courtside ladder','ladder') id")
  ).rows[0].id;
  await db.query(
    "UPDATE leagues SET status='active',visibility='private',location='Main venue',branding=$2 WHERE id=$1",
    [league, JSON.stringify(branding)]
  );
  season = (
    await db.query<{ id: string }>(
      "INSERT INTO league_seasons(league_id,name,status) VALUES($1,'Autumn','active') RETURNING id",
      [league]
    )
  ).rows[0].id;
  for (const user of ids.slice(1, 5))
    await db.query(
      "INSERT INTO league_members(league_id,season_id,user_id) VALUES($1,$2,$3)",
      [league, season, user]
    );
  session = (
    await db.query<{ id: string }>(
      "INSERT INTO league_sessions(league_id,season_id,name,status,scheduled_date,start_time,location) VALUES($1,$2,'Week one','published',CURRENT_DATE+1,'18:30','North courts') RETURNING id",
      [league, season]
    )
  ).rows[0].id;
  match = (
    await db.query<{ id: string }>(
      "INSERT INTO league_matches(league_id,season_id,session_id,player_a_id,player_b_id,player_c_id,player_d_id,court_number) VALUES($1,$2,$3,$4,$5,$6,$7,2) RETURNING id",
      [league, season, session, player, partner, opponent, opponentPartner]
    )
  ).rows[0].id;
});

it("shows session-scheduled ladder games with branding, season, venue override and both partnerships", async () => {
  expect(await upcoming()).toMatchObject([
    {
      match_id: match,
      league_id: league,
      season_id: season,
      season_name: "Autumn",
      league_branding: branding,
      has_match_time: false,
      session_start_time: "18:30:00",
      court_number: 2,
      location: "North courts",
      team_a_name: "Avery & Blake",
      team_b_name: "Casey & Devon",
    },
  ]);
  expect(await upcoming(outsider)).toEqual([]);
  await expect(
    leagueActor(db, null)("SELECT * FROM get_my_upcoming_league_matches()")
  ).rejects.toThrow();
});

it("uses explicit match times and team names while retaining assigned substitutes", async () => {
  const team = (
    await db.query<{ id: string }>(
      "INSERT INTO league_teams(league_id,season_id,name) VALUES($1,$2,'Court Crew') RETURNING id",
      [league, season]
    )
  ).rows[0].id;
  await db.query(
    "UPDATE league_matches SET scheduled_time=now()+interval '2 days',team_a_id=$2 WHERE id=$1",
    [match, team]
  );
  await db.query(
    "UPDATE league_members SET status='removed' WHERE user_id=$1",
    [player]
  );
  expect(await upcoming()).toEqual([]);
  await db.query(
    "INSERT INTO league_substitutes(league_id,season_id,user_id) VALUES($1,$2,$3)",
    [league, season, player]
  );
  expect(await upcoming()).toMatchObject([
    { has_match_time: true, team_a_name: "Court Crew" },
  ]);
});

it.each(["draft", "canceled", "completed"])(
  "hides %s sessions even with an explicit upcoming match time",
  async (status) => {
    await db.query(
      "UPDATE league_matches SET scheduled_time=now()+interval '2 days' WHERE id=$1",
      [match]
    );
    if (status !== "draft")
      await db.query(
        "UPDATE league_matches SET status='canceled' WHERE id=$1",
        [match]
      );
    await db.query("UPDATE league_sessions SET status=$2 WHERE id=$1", [
      session,
      status,
    ]);
    expect(await upcoming()).toEqual([]);
  }
);

it("hides canceled games, past sessions, archived leagues and completed seasons", async () => {
  await db.query("UPDATE league_matches SET status='canceled' WHERE id=$1", [
    match,
  ]);
  expect(await upcoming()).toEqual([]);
  await db.query("UPDATE league_matches SET status='scheduled' WHERE id=$1", [
    match,
  ]);
  await db.query(
    "UPDATE league_sessions SET scheduled_date=CURRENT_DATE-1 WHERE id=$1",
    [session]
  );
  expect(await upcoming()).toEqual([]);
  await db.query(
    "UPDATE league_sessions SET scheduled_date=CURRENT_DATE+1 WHERE id=$1",
    [session]
  );
  await db.query("UPDATE leagues SET status='archived' WHERE id=$1", [league]);
  expect(await upcoming()).toEqual([]);
  await db.query("UPDATE leagues SET status='active' WHERE id=$1", [league]);
  await db.query("UPDATE league_matches SET status='canceled' WHERE id=$1", [
    match,
  ]);
  await db.query("UPDATE league_seasons SET status='completed' WHERE id=$1", [
    season,
  ]);
  expect(await upcoming()).toEqual([]);
});

it("keeps in-progress games visible and handles date-only sessions and limits", async () => {
  await db.query(
    "UPDATE league_matches SET scheduled_time=now()-interval '1 hour',status='in_progress' WHERE id=$1",
    [match]
  );
  expect(await upcoming()).toHaveLength(1);
  await db.query(
    "UPDATE league_matches SET scheduled_time=null,status='scheduled' WHERE id=$1",
    [match]
  );
  await db.query("UPDATE league_sessions SET start_time=null WHERE id=$1", [
    session,
  ]);
  expect(await upcoming()).toMatchObject([
    { has_match_time: false, session_start_time: null },
  ]);
  expect(await upcoming(player, 0)).toEqual([]);
  expect(await upcoming(player, -1)).toEqual([]);
  expect(await upcoming(player, null)).toHaveLength(1);
});

it("links score notifications to the affected season and the correct game-day or results tab", async () => {
  await db.query(
    "UPDATE league_matches SET scheduled_time=now()-interval '1 hour' WHERE id=$1",
    [match]
  );
  await leagueActor(db, player)("SELECT submit_league_match_score($1,11,6)", [
    match,
  ]);
  const pending = (
    await db.query<{ link: string; recipient: string }>(
      "SELECT link,recipient FROM notifications WHERE kind='league_score_submitted'"
    )
  ).rows;
  expect(pending).toHaveLength(3);
  expect(
    pending.every(
      (row) =>
        row.link === `/player/leagues/${league}?season=${season}#gameday` &&
        row.recipient !== player
    )
  ).toBe(true);
  await leagueActor(db, opponent)(
    "SELECT confirm_league_match_score($1,11,6)",
    [match]
  );
  const completed = (
    await db.query<{ link: string }>(
      "SELECT link FROM notifications WHERE kind='league_match_verified'"
    )
  ).rows;
  expect(completed).toHaveLength(4);
  expect(
    completed.every(
      (row) => row.link === `/player/leagues/${league}?season=${season}#results`
    )
  ).toBe(true);
});
