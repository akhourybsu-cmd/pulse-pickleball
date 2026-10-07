import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";

let db: PGlite;
const id = (n: number) =>
  `20000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE round_robin_events(id uuid PRIMARY KEY,status text,venue_id uuid,group_id uuid,voided boolean DEFAULT false);
    CREATE TABLE round_robin_players(event_id uuid,player_id uuid,guest_player_id uuid,active boolean,registration_status text);
    CREATE TABLE round_robin_schedule(event_id uuid,a1_player_id uuid,a2_player_id uuid,b1_player_id uuid,b2_player_id uuid,
      a1_guest_id uuid,a2_guest_id uuid,b1_guest_id uuid,b2_guest_id uuid,voided_at timestamptz,superseded_by_schedule_id uuid);
    CREATE TABLE profiles(id uuid PRIMARY KEY,full_name text,display_name text,email text);
    CREATE TABLE guest_players(id uuid PRIMARY KEY,display_name text,email text);
    CREATE FUNCTION can_access_private_venue(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT $1 IS DISTINCT FROM '${id(
      90
    )}'::uuid $$;
    CREATE FUNCTION can_access_private_group(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT $1 IS DISTINCT FROM '${id(
      91
    )}'::uuid $$;
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;`);
  const sql = readFileSync(
    "supabase/migrations/20261008001000_round_robin_kiosk_roster.sql",
    "utf8"
  );
  await db.exec(sql);
  await db.exec(sql);
});
beforeEach(async () => {
  await db.exec(`RESET ROLE; TRUNCATE round_robin_events,round_robin_players,round_robin_schedule,profiles,guest_players;
    INSERT INTO round_robin_events(id,status) VALUES('${id(1)}','live');
    INSERT INTO profiles VALUES('${id(
      2
    )}','Full Name','Display Name','private@example.test'),('${id(
    4
  )}','Historical Only',NULL,'private@example.test');
    INSERT INTO guest_players VALUES('${id(
      3
    )}','Guest Name','private@example.test');
    INSERT INTO round_robin_players VALUES('${id(1)}','${id(
    2
  )}',NULL,true,'confirmed'),('${id(1)}',NULL,'${id(3)}',false,'confirmed');
    INSERT INTO round_robin_schedule(event_id,a1_player_id,b2_guest_id) VALUES('${id(
      1
    )}','${id(2)}','${id(3)}');
    INSERT INTO round_robin_schedule(event_id,a1_player_id,voided_at) VALUES('${id(
      1
    )}','${id(4)}',now());`);
});
afterAll(async () => {
  await db?.close();
});
const read = async () => {
  await db.exec("SET ROLE anon");
  return (await db.query("SELECT * FROM rr_kiosk_participants($1)", [id(1)]))
    .rows;
};
it("serves only scheduled names and roster status without private profile access", async () => {
  expect(await read()).toEqual([
    {
      participant_id: id(2),
      name: "Display Name",
      is_guest: false,
      active: true,
    },
    {
      participant_id: id(3),
      name: "Guest Name",
      is_guest: true,
      active: false,
    },
  ]);
  await expect(db.query("SELECT email FROM profiles")).rejects.toThrow(
    /permission denied/
  );
  await expect(db.query("SELECT * FROM round_robin_players")).rejects.toThrow(
    /permission denied/
  );
});
it.each([
  "status='draft'",
  "status='voided'",
  "voided=true",
  `venue_id='${id(90)}'`,
  `group_id='${id(91)}'`,
])("does not publish a restricted event: %s", async (update) => {
  await db.exec(`UPDATE round_robin_events SET ${update}`);
  expect(await read()).toEqual([]);
});
it("preserves completed event results and excludes waitlisted players from ranks", async () => {
  await db.exec(
    "UPDATE round_robin_events SET status='completed'; UPDATE round_robin_players SET registration_status='waitlisted' WHERE active"
  );
  expect((await read()).every((row) => row.active === false)).toBe(true);
});
it("treats missing roster rows as historical and follows guest replacements", async () => {
  await db.exec(
    "DELETE FROM round_robin_players WHERE player_id IS NOT NULL; UPDATE round_robin_players SET active=true"
  );
  expect(await read()).toMatchObject([
    { active: false, is_guest: false },
    { active: true, is_guest: true },
  ]);
});
