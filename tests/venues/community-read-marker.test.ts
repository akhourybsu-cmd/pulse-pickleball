import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, it, expect } from "vitest";
let db: PGlite;
const id = (n: number) =>
  `74000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`CREATE ROLE authenticated;CREATE ROLE anon;CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.user',true),'')::uuid $$;
CREATE FUNCTION pulse_has_required_mfa() RETURNS bool LANGUAGE sql AS $$ SELECT current_setting('test.mfa',true) IS DISTINCT FROM 'false' $$;
CREATE TABLE group_members(id uuid,group_id uuid,user_id uuid,status text,last_read_at timestamptz,last_chat_read_at timestamptz);
INSERT INTO group_members VALUES('${id(1)}','${id(10)}','${id(100)}','active','2020-01-01','2020-02-01T00:00:00Z'),('${id(2)}','${id(10)}','${id(101)}','active','2020-01-01','2020-02-01T00:00:00Z'),('${id(3)}','${id(11)}','${id(100)}','pending','2020-01-01','2020-02-01T00:00:00Z');
SELECT set_config('test.user','${id(100)}',false);`);
  await db.exec(
    readFileSync(
      "supabase/migrations/20260930131000_community_read_marker.sql",
      "utf8",
    ),
  );
}, 30000);
afterAll(() => db?.close());
async function mark(group: string, role = "authenticated") {
  await db.exec("SET ROLE " + role);
  try {
    return (
      await db.query<any>("SELECT mark_community_read($1) marker", [group])
    ).rows[0].marker;
  } finally {
    await db.exec("RESET ROLE");
  }
}
it("acknowledges only the caller’s active membership using server time and preserves chat unread state", async () => {
  const marker = await mark(id(10));
  expect(new Date(marker).getFullYear()).toBeGreaterThan(2020);
  const rows = (
    await db.query<any>(
      "SELECT *,last_read_at=$1::timestamptz marked FROM group_members ORDER BY id",
      [marker],
    )
  ).rows;
  expect(rows.map((r) => r.marked)).toEqual([true, false, false]);
  expect(rows[0].last_chat_read_at.toISOString()).toBe(
    "2020-02-01T00:00:00.000Z",
  );
  expect(await mark(id(11))).toBeNull();
  expect(await mark(id(99))).toBeNull();
});
it("requires an authenticated session with the required MFA level", async () => {
  await expect(mark(id(10), "anon")).rejects.toThrow(/permission denied/);
  await db.exec("SELECT set_config('test.mfa','false',false)");
  await expect(mark(id(10))).rejects.toThrow(/Sign in required/);
  await db.exec(
    "SELECT set_config('test.mfa','true',false);SELECT set_config('test.user','',false)",
  );
  await expect(mark(id(10))).rejects.toThrow(/Sign in required/);
});
