import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const db = new PGlite();
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const host = id(1),
  player = id(2),
  teammate = id(3),
  removed = id(4),
  outsider = id(5);
const event = id(10),
  otherEvent = id(11),
  publicEvent = id(12);
const migration =
  "supabase/migrations/20260930090000_round_robin_participant_roster_read.sql";
const rows = async (eventId = event) =>
  (
    await db.query<{ id: string }>(
      "SELECT id FROM round_robin_players WHERE event_id=$1 ORDER BY id",
      [eventId],
    )
  ).rows;
const asPlayer = async (user = player) => {
  await db.exec("RESET ROLE; SET ROLE authenticated");
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [user]);
};

beforeAll(async () => {
  await db.exec(`
    CREATE ROLE authenticated; CREATE ROLE anon; CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    CREATE TYPE app_role AS ENUM('admin');
    CREATE FUNCTION has_role(uuid, app_role) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
    CREATE TABLE round_robin_events(id uuid PRIMARY KEY, organizer_id uuid, is_published boolean DEFAULT false, registration_mode text DEFAULT 'manual', status text DEFAULT 'draft');
    CREATE TABLE round_robin_players(id uuid PRIMARY KEY, event_id uuid, player_id uuid, guest_player_id uuid, active boolean DEFAULT true, registration_status text DEFAULT 'confirmed');
    CREATE TABLE round_robin_schedule(id uuid,event_id uuid);
    ALTER TABLE round_robin_events ENABLE ROW LEVEL SECURITY;
    ALTER TABLE round_robin_players ENABLE ROW LEVEL SECURITY;
    ALTER TABLE round_robin_schedule ENABLE ROW LEVEL SECURITY;
    GRANT USAGE ON SCHEMA public,auth TO authenticated,anon;
    GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
    GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
    INSERT INTO round_robin_events(id,organizer_id) VALUES('${event}','${host}'),('${otherEvent}','${host}');
    INSERT INTO round_robin_events(id,organizer_id,is_published,registration_mode) VALUES('${publicEvent}','${host}',true,'open_registration');
    INSERT INTO round_robin_players(id,event_id,player_id,guest_player_id,active,registration_status) VALUES
      ('${id(20)}','${event}','${player}',null,true,'confirmed'),
      ('${id(21)}','${event}','${teammate}',null,true,'confirmed'),
      ('${id(22)}','${event}',null,'${id(90)}',true,'confirmed'),
      ('${id(23)}','${event}','${removed}',null,false,'confirmed'),
      ('${id(24)}','${event}','${id(6)}',null,true,'waitlisted'),
      ('${id(25)}','${otherEvent}','${outsider}',null,true,'confirmed'),
      ('${id(26)}','${publicEvent}','${outsider}',null,true,'confirmed');
  `);
  // Use the original membership helper and RLS, not a permissive test stub.
  await db.exec(
    readFileSync(
      "supabase/migrations/20251020143622_2f244f74-68cf-4705-aa76-218cf3353be6.sql",
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/20251106165133_b7da66b1-2f31-4070-891a-63244d5b0681.sql",
      "utf8",
    ),
  );
  await db.exec(
    `CREATE POLICY published_event_read ON round_robin_events FOR SELECT USING(is_published AND registration_mode='open_registration')`,
  );
  await asPlayer();
  expect(await rows()).toEqual([{ id: id(20) }]); // Reproduce the reported self-only roster.
  await db.exec("RESET ROLE");
  await db.exec(readFileSync(migration, "utf8"));
}, 30000);
afterAll(() => db.close());

describe("participant roster visibility", () => {
  it.each(["draft", "live", "completed"])(
    "shows the complete private %s roster without requiring published rounds",
    async (status) => {
      await db.exec("RESET ROLE");
      await db.query("UPDATE round_robin_events SET status=$1 WHERE id=$2", [
        status,
        event,
      ]);
      await asPlayer();
      expect((await rows()).map((row) => row.id)).toEqual(
        [20, 21, 22, 23, 24].map(id),
      );
      // This is the event-preview query, which excludes withdrawn historical rows.
      expect(
        (
          await db.query(
            "SELECT id FROM round_robin_players WHERE event_id=$1 AND active=true",
            [event],
          )
        ).rows,
      ).toHaveLength(4);
    },
  );
  it("gives the other registered player and a waitlisted player the same complete roster", async () => {
    for (const user of [teammate, id(6)]) {
      await asPlayer(user);
      expect(await rows()).toHaveLength(5);
    }
  });
  it("does not reveal another private event or grant access to an outsider", async () => {
    await asPlayer();
    expect(await rows(otherEvent)).toEqual([]);
    await asPlayer(outsider);
    expect(await rows()).toEqual([]);
  });
  it("withdrawn participants retain only their own row under the pre-existing policy", async () => {
    await asPlayer(removed);
    expect(await rows()).toEqual([{ id: id(23) }]);
  });
  it("does not let anonymous visitors see the private roster", async () => {
    await db.exec(
      "RESET ROLE; SET ROLE anon; SELECT set_config('request.jwt.claim.sub','',false)",
    );
    expect(await rows()).toEqual([]);
  });
  it("preserves the existing organizer and published-registration read paths", async () => {
    await asPlayer(host);
    expect(await rows()).toHaveLength(5);
    await asPlayer(outsider);
    expect(await rows(publicEvent)).toHaveLength(1);
  });
  it("does not let a participant edit, remove, or add other players", async () => {
    await asPlayer();
    expect(
      (
        await db.query(
          "UPDATE round_robin_players SET active=false WHERE id=$1 RETURNING id",
          [id(21)],
        )
      ).rows,
    ).toEqual([]);
    expect(
      (
        await db.query(
          "DELETE FROM round_robin_players WHERE id=$1 RETURNING id",
          [id(21)],
        )
      ).rows,
    ).toEqual([]);
    await expect(
      db.query(
        "INSERT INTO round_robin_players(id,event_id,player_id) VALUES($1,$2,$3)",
        [id(99), event, outsider],
      ),
    ).rejects.toMatchObject({ code: "42501" });
    expect(await rows()).toHaveLength(5);
  });
  it("still honors restrictive security policies", async () => {
    await db.exec(
      "RESET ROLE; CREATE POLICY extra_verification ON round_robin_players AS RESTRICTIVE FOR SELECT TO authenticated USING(false)",
    );
    await asPlayer();
    expect(await rows()).toEqual([]);
    await db.exec(
      "RESET ROLE; DROP POLICY extra_verification ON round_robin_players",
    );
  });
});
