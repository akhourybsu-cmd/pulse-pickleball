import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, expect, it } from "vitest";

let db: PGlite;
const migration = readFileSync("supabase/migrations/20261007180000_round_robin_realtime.sql", "utf8");
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE TABLE round_robin_events (id uuid PRIMARY KEY);
    CREATE TABLE round_robin_schedule (id uuid PRIMARY KEY, event_id uuid);
    CREATE TABLE round_robin_players (id uuid PRIMARY KEY, event_id uuid);
    CREATE TABLE existing_table (id uuid PRIMARY KEY);
    ALTER TABLE round_robin_events ENABLE ROW LEVEL SECURITY;
    CREATE POLICY example_policy ON round_robin_events FOR SELECT USING (false);
    CREATE PUBLICATION supabase_realtime FOR TABLE existing_table, round_robin_events;
  `);
}, 20_000);
afterAll(async () => { await db?.close(); });

it("enables all three event tables, preserves existing publication entries and read policies, and is replay-safe", async () => {
  await db.exec(migration);
  await db.exec(migration);
  const { rows } = await db.query("SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' ORDER BY tablename");
  expect(rows).toEqual(["existing_table", "round_robin_events", "round_robin_players", "round_robin_schedule"].map(tablename => ({ tablename })));
  expect((await db.query("SELECT relrowsecurity FROM pg_class WHERE relname = 'round_robin_events'")).rows).toEqual([{ relrowsecurity: true }]);
  expect((await db.query("SELECT policyname, qual FROM pg_policies WHERE tablename = 'round_robin_events'")).rows).toEqual([{ policyname: "example_policy", qual: "false" }]);
});
