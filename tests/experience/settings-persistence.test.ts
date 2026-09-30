import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";

const owner = "10000000-0000-0000-0000-000000000001";
const stranger = "10000000-0000-0000-0000-000000000002";
const group = "10000000-0000-0000-0000-000000000010";
let db: PGlite;
async function asUser(user: string | null, sql: string, args: unknown[] = []) {
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [
    user ?? "",
  ]);
  await db.exec("SET ROLE authenticated");
  try {
    return await db.query(sql, args);
  } finally {
    await db.exec("RESET ROLE");
  }
}
const patch = (value: unknown, user: string | null = owner) =>
  asUser(user, "SELECT patch_group_settings($1,$2) AS settings", [
    group,
    value,
  ]);
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`CREATE ROLE authenticated; CREATE ROLE anon; CREATE SCHEMA auth;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 CREATE FUNCTION pulse_has_required_mfa() RETURNS boolean LANGUAGE sql AS $$ SELECT coalesce(current_setting('test.mfa',true),'yes')<>'no' $$;
 GRANT USAGE ON SCHEMA auth TO authenticated;
 CREATE TABLE groups(id uuid PRIMARY KEY,owner_id uuid,settings jsonb);
 ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
 CREATE POLICY view_group ON groups FOR SELECT USING(true);
 CREATE POLICY edit_group ON groups FOR UPDATE USING(owner_id=auth.uid());
 GRANT SELECT,UPDATE ON groups TO authenticated;
 CREATE TABLE user_notifications(id uuid PRIMARY KEY,user_id uuid,created_at timestamptz DEFAULT now(),read boolean DEFAULT false);
 ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;
 CREATE POLICY own_notifications ON user_notifications FOR ALL USING(user_id=auth.uid());
 GRANT SELECT,UPDATE ON user_notifications TO authenticated;`);
  await db.exec(
    readFileSync(
      "supabase/migrations/20260930170000_experience_integrity.sql",
      "utf8",
    ),
  );
}, 30000);
beforeEach(async () => {
  await db.exec(
    "SELECT set_config('test.mfa','yes',false); TRUNCATE groups,user_notifications;",
  );
  await db.query("INSERT INTO groups VALUES($1,$2,$3)", [
    group,
    owner,
    { chat_enabled: true, files_enabled: true, branding: { color: "#abc" } },
  ]);
  await db.query("INSERT INTO user_notifications(id,user_id) VALUES($1,$2)", [
    group,
    owner,
  ]);
});
afterAll(async () => {
  await db?.close();
});
it("merges independent edits without erasing unrelated settings or false values", async () => {
  await patch({ chat_enabled: false });
  await patch({ files_enabled: false });
  expect(
    (await db.query("SELECT settings FROM groups")).rows[0].settings,
  ).toEqual({
    chat_enabled: false,
    files_enabled: false,
    branding: { color: "#abc" },
  });
});
it("rejects unauthenticated users, nonowners and missing MFA", async () => {
  await expect(patch({ chat_enabled: false }, null)).rejects.toThrow("Sign in");
  await expect(patch({ chat_enabled: false }, stranger)).rejects.toThrow(
    "not saved",
  );
  await db.exec("SELECT set_config('test.mfa','no',false)");
  await expect(patch({ chat_enabled: false })).rejects.toThrow("Sign in");
  expect(
    (await db.query("SELECT settings FROM groups")).rows[0].settings,
  ).toMatchObject({ chat_enabled: true });
});
it("rejects malformed patches and unknown keys", async () => {
  for (const value of [
    null,
    [],
    { chat_enabled: "false" },
    { branding: false },
  ])
    await expect(patch(value)).rejects.toThrow();
  expect(
    (
      await db.query(
        "SELECT has_function_privilege('anon','patch_group_settings(uuid,jsonb)','EXECUTE') AS allowed",
      )
    ).rows[0].allowed,
  ).toBe(false);
});
it("keeps dismissal reversible while preserving notification ownership", async () => {
  expect(
    (
      await asUser(
        stranger,
        "UPDATE user_notifications SET dismissed_at=now() WHERE id=$1 RETURNING id",
        [group],
      )
    ).rows,
  ).toHaveLength(0);
  await asUser(
    owner,
    "UPDATE user_notifications SET dismissed_at=now() WHERE id=$1",
    [group],
  );
  expect(
    (
      await asUser(
        owner,
        "SELECT * FROM user_notifications WHERE dismissed_at IS NULL",
      )
    ).rows,
  ).toHaveLength(0);
  await asUser(
    owner,
    "UPDATE user_notifications SET dismissed_at=NULL WHERE id=$1",
    [group],
  );
  expect(
    (
      await asUser(
        owner,
        "SELECT * FROM user_notifications WHERE dismissed_at IS NULL",
      )
    ).rows,
  ).toHaveLength(1);
});
