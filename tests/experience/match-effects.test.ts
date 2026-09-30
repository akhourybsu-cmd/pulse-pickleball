import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import {
  matchIntegrityQuery,
  checkMatchSystem,
} from "../../scripts/check-match-system.mjs";
const read = (file: string) =>
  readFileSync(`supabase/migrations/${file}`, "utf8");
function fn(file: string, name: string) {
  const sql = read(file);
  const start = sql.search(
    new RegExp(`CREATE OR REPLACE FUNCTION public\\.${name}\\s*\\(`, "i"),
  );
  if (start < 0) throw new Error(name);
  const delimiter = sql.slice(start).match(/\bAS\s+(\$\w*\$)/i)![1];
  return sql.slice(
    start,
    sql.indexOf(`${delimiter};`, start) + delimiter.length + 1,
  );
}
const id = (n: number) =>
  `10000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
let db: PGlite;
const stats = async () =>
  (
    await db.query(
      "SELECT id,current_rating,total_matches,wins,losses,total_points_for,total_points_against FROM profiles ORDER BY id",
    )
  ).rows;
async function seedMatch(n = 10, ranked = true, date = "2026-09-01") {
  await db.query(
    "INSERT INTO matches(id,status,match_date,team1_score,team2_score,count_for_rating) VALUES($1,'pending',$2,11,5,$3)",
    [id(n), date, ranked],
  );
  for (let p = 1; p <= 4; p++)
    await db.query(
      "INSERT INTO match_participants(match_id,player_id,team) VALUES($1,$2,$3)",
      [id(n), id(p), p <= 2 ? 1 : 2],
    );
  for (let p = 1; p <= 4; p++)
    await db.query(
      "INSERT INTO match_approvals(match_id,player_id) VALUES($1,$2)",
      [id(n), id(p)],
    );
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role BYPASSRLS;
 CREATE TABLE profiles(id uuid PRIMARY KEY,initial_self_rating numeric DEFAULT 3.5,current_rating numeric DEFAULT 3.5,week_start_rating numeric,week_start_date date,total_matches integer DEFAULT 0,wins integer DEFAULT 0,losses integer DEFAULT 0,total_points_for integer DEFAULT 0,total_points_against integer DEFAULT 0,updated_at timestamptz);
 CREATE TABLE matches(id uuid PRIMARY KEY,status text,verification_status text,voided boolean DEFAULT false,count_for_rating boolean DEFAULT true,team1_score integer,team2_score integer,match_date timestamptz,created_at timestamptz DEFAULT now(),week_start date DEFAULT '2026-08-31',match_type text DEFAULT 'league');
 CREATE TABLE match_participants(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),match_id uuid REFERENCES matches ON DELETE CASCADE,player_id uuid REFERENCES profiles,team integer,rating_before numeric,rating_after numeric,rating_change numeric);
 CREATE TABLE match_approvals(id uuid DEFAULT gen_random_uuid(),match_id uuid,player_id uuid,approved boolean);
 CREATE FUNCTION get_week_start(date) RETURNS date LANGUAGE sql AS $$ SELECT date_trunc('week',$1)::date $$;`);
  await db.exec(
    read("20251001193842_b730a111-5cad-446d-8a19-cf386b5726c7.sql").split(
      "-- Insert default parameters",
    )[0],
  );
  await db.exec(
    "INSERT INTO rating_parameters(id) VALUES('00000000-0000-0000-0000-000000000001')",
  );
  await db.exec(read("20260805170000_placement_scaffolding.sql"));
  await db.exec(
    fn(
      "20251001202644_99bdd03b-6c8d-4d44-ad36-8e80e38b393d.sql",
      "recalculate_all_player_stats",
    ),
  );
  await db.exec(
    fn(
      "20260805191005_43b6efc4-0a3b-4d7d-9f39-f165aae4f44d.sql",
      "recalculate_player_stats",
    ),
  );
  await db.exec(read("20260930171000_preserve_ranked_rating_in_stats.sql"));
  await db.exec(read("20260805180000_placement_engine_gated.sql"));
  await db.exec(
    fn(
      "20260703140000_incremental_rating_updates.sql",
      "handle_match_approval_recalc",
    ),
  );
  await db.exec(
    fn(
      "20251001202644_99bdd03b-6c8d-4d44-ad36-8e80e38b393d.sql",
      "handle_match_status_change",
    ),
  );
  await db.exec(
    fn(
      "20260620004241_0dd46f8d-1de1-46e3-8a4a-0ea04e57298b.sql",
      "auto_approve_match_on_verification",
    ),
  );
  await db.exec(`CREATE TRIGGER on_match_approval_recalc AFTER INSERT OR UPDATE ON matches FOR EACH ROW EXECUTE FUNCTION handle_match_approval_recalc();
 CREATE TRIGGER on_match_status_change AFTER UPDATE OF status ON matches FOR EACH ROW EXECUTE FUNCTION handle_match_status_change();
 CREATE TRIGGER trigger_auto_approve_match AFTER INSERT OR UPDATE OF approved ON match_approvals FOR EACH ROW EXECUTE FUNCTION auto_approve_match_on_verification();`);
}, 30000);
beforeEach(async () => {
  await db.exec(
    "TRUNCATE profiles,matches,match_participants,match_approvals CASCADE",
  );
  for (let p = 1; p <= 4; p++)
    await db.query("INSERT INTO profiles(id) VALUES($1)", [id(p)]);
  await seedMatch();
});
afterAll(async () => {
  await db?.close();
});
async function approve(n = 10) {
  await db.query(
    "UPDATE match_approvals SET approved=true WHERE match_id=$1 AND player_id IN ($2,$3,$4)",
    [id(n), id(1), id(2), id(3)],
  );
}
it("approves at the server threshold and records score, totals and ratings exactly once", async () => {
  await approve();
  const first = await stats();
  expect(first[0]).toMatchObject({
    total_matches: 1,
    wins: 1,
    losses: 0,
    total_points_for: 11,
    total_points_against: 5,
  });
  expect(Number(first[0].current_rating)).toBeGreaterThan(3.5);
  await approve();
  await db.query(
    "UPDATE match_approvals SET approved=true WHERE player_id=$1",
    [id(4)],
  );
  expect(await stats()).toEqual(first);
});
it("replays rating and statistics after a score correction and void", async () => {
  await approve();
  await db.query(
    "UPDATE matches SET team1_score=4,team2_score=11 WHERE id=$1",
    [id(10)],
  );
  expect((await stats())[0]).toMatchObject({
    wins: 0,
    losses: 1,
    total_points_for: 4,
  });
  expect(Number((await stats())[0].current_rating)).toBeLessThan(3.5);
  await db.query("UPDATE matches SET voided=true WHERE id=$1", [id(10)]);
  expect((await stats())[0]).toMatchObject({
    total_matches: 0,
    wins: 0,
    losses: 0,
    current_rating: "3.5",
  });
});
it("keeps rejected matches out of totals and ratings", async () => {
  await db.query(
    "UPDATE match_approvals SET approved=false WHERE player_id=$1",
    [id(4)],
  );
  await approve();
  expect((await db.query("SELECT status FROM matches")).rows[0].status).toBe(
    "rejected",
  );
  expect((await stats())[0].total_matches).toBe(0);
});
it("preserves ranked ratings when a newer unranked match updates the playing record", async () => {
  await approve();
  const rating = (await stats())[0].current_rating;
  await seedMatch(11, false, "2026-09-02");
  await approve(11);
  expect((await stats())[0]).toMatchObject({
    current_rating: rating,
    total_matches: 2,
    wins: 2,
  });
});
it("produces the same final ratings for chronological and backdated approvals", async () => {
  await seedMatch(11, true, "2026-09-02");
  await approve(11);
  await approve(10);
  const backdated = await stats();
  await db.exec("SELECT recalculate_all_ratings()");
  expect(await stats()).toEqual(backdated);
});
it("detects historical record drift without changing player data or exposing identities", async () => {
  await approve();
  expect((await db.query(matchIntegrityQuery)).rows[0].checks).toMatchObject({
    record_mismatches: 0,
    ranked_rating_mismatches: 0,
  });
  await db.query(
    "UPDATE profiles SET wins=99,current_rating=3.00 WHERE id=$1",
    [id(1)],
  );
  expect((await db.query(matchIntegrityQuery)).rows[0].checks).toMatchObject({
    record_mismatches: 1,
    ranked_rating_mismatches: 1,
    mismatches_with_ranked_history: 1,
    mismatches_without_ranked_history: 0,
    mismatches_without_playing_record: 0,
  });
  expect((await stats())[0].wins).toBe(99);
});
it("repairs only recorded rating caches, preserves history and audits each correction once", async () => {
  await approve();
  const original = await stats();
  const matches = (await db.query("SELECT * FROM matches ORDER BY id")).rows;
  const snapshots = (
    await db.query("SELECT * FROM match_participants ORDER BY id")
  ).rows;
  await db.query("UPDATE profiles SET current_rating=3 WHERE id=$1", [id(1)]);
  await db.query(
    "INSERT INTO profiles(id,initial_self_rating,current_rating) VALUES($1,4,4.25)",
    [id(5)],
  );
  const repair = read("20260930180000_reconcile_recorded_rating_cache.sql");
  await db.exec(repair);
  expect((await stats()).slice(0, 4)).toEqual(original);
  expect((await stats())[4].current_rating).toBe("4.25");
  expect((await db.query("SELECT * FROM matches ORDER BY id")).rows).toEqual(
    matches,
  );
  expect(
    (await db.query("SELECT * FROM match_participants ORDER BY id")).rows,
  ).toEqual(snapshots);
  const audit = (await db.query("SELECT * FROM rating_cache_repair_audit"))
    .rows;
  expect(audit).toHaveLength(1);
  expect(audit[0]).toMatchObject({
    player_id: id(1),
    previous_rating: "3",
    corrected_rating: original[0].current_rating,
    source_match_id: id(10),
  });
  await db.exec(repair);
  expect(
    (await db.query("SELECT * FROM rating_cache_repair_audit")).rows,
  ).toEqual(audit);
  for (const role of ["anon", "authenticated"]) {
    await db.exec(`SET ROLE ${role}`);
    await expect(
      db.query("SELECT * FROM rating_cache_repair_audit"),
    ).rejects.toThrow(/permission denied/);
    await db.exec("RESET ROLE");
  }
  await db.exec("SET ROLE service_role");
  expect(
    (await db.query("SELECT * FROM rating_cache_repair_audit")).rows,
  ).toEqual(audit);
  await db.exec("RESET ROLE");
});
it("restores a player's own starting rating when their only approved history is unranked", async () => {
  await db.exec("UPDATE matches SET count_for_rating=false");
  await approve();
  await db.query(
    "UPDATE profiles SET initial_self_rating=4.25,current_rating=3 WHERE id=$1",
    [id(1)],
  );
  await db.exec(read("20260930180000_reconcile_recorded_rating_cache.sql"));
  expect((await stats())[0]).toMatchObject({
    current_rating: "4.25",
    total_matches: 1,
    wins: 1,
  });
  expect(
    (await db.query("SELECT * FROM rating_cache_repair_audit")).rows,
  ).toEqual([
    expect.objectContaining({
      player_id: id(1),
      previous_rating: "3",
      corrected_rating: "4.25",
      source_match_id: null,
    }),
  ]);
  expect(
    Object.values((await db.query(matchIntegrityQuery)).rows[0].checks),
  ).toEqual(expect.arrayContaining([0]));
  expect(
    Object.values((await db.query(matchIntegrityQuery)).rows[0].checks).every(
      (value) => value === 0,
    ),
  ).toBe(true);
});
it("runs the deployed audit in read-only mode and keeps provider error details private", async () => {
  const env = {
    SUPABASE_PROJECT_REF: "rqfqwavhtfwwtmfjnxkx",
    SUPABASE_ACCESS_TOKEN: "sbp_test",
  };
  const report = await checkMatchSystem(env, async (_url, options) => {
    expect(JSON.parse(options.body)).toEqual({
      query: matchIntegrityQuery,
      read_only: true,
    });
    return {
      ok: true,
      json: async () => [
        { checks: { record_mismatches: 0, ranked_rating_mismatches: 0 } },
      ],
    };
  });
  expect(report.integrityPassed).toBe(true);
  await expect(
    checkMatchSystem(env, async () => ({
      ok: false,
      status: 503,
      json: async () => ({ secret: "hidden" }),
    })),
  ).rejects.toThrow("HTTP 503");
});
