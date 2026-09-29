import { readFileSync } from "node:fs";
import { beforeAll, beforeEach, afterAll, it, expect } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { venueSuiteDatabase } from "../helpers/venueSuiteDatabase";
const id = (n: number) =>
  `81000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const owner = id(1),
  player = id(2),
  other = id(3),
  staff = id(4),
  venue = id(5),
  group = id(6);
let db: PGlite;
async function as(
  user: string | null,
  sql: string,
  args: unknown[] = [],
  role = "authenticated",
) {
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [
    user || "",
  ]);
  await db.exec(`SET ROLE ${role}`);
  try {
    return (await db.query<any>(sql, args)).rows;
  } finally {
    await db.exec(
      "RESET ROLE; SELECT set_config('request.jwt.claim.sub','',false)",
    );
  }
}
const service = (sql: string, args: unknown[] = []) =>
  as(null, sql, args, "service_role");
const workspace = async () =>
  (await as(owner, "SELECT venue_email_workspace($1) w", [venue]))[0].w;
const config = {
  provider: "resend",
  sender_name: "Rally Haus",
  from_email: "hello@venue.test",
  reply_to: "desk@venue.test",
  message_stream: "broadcast",
  footer: "See you on the courts.",
};
const save = (
  expected: string | null = null,
  key: string | null = "re_test_credential_not_real",
) =>
  service("SELECT venue_email_save($1,$2,$3,$4,$5)", [
    venue,
    owner,
    expected,
    config,
    key,
  ]);
async function ready() {
  await save();
  const c = (await workspace()).connection;
  await service("SELECT venue_email_test($1,$2,$3,$4)", [
    venue,
    owner,
    c.version,
    id(10),
  ]);
  const j = (await service("SELECT venue_email_claim($1) c", [id(10)]))[0].c;
  await service(
    "SELECT venue_email_finish($1,$2,'accepted','test-provider-id')",
    [j.job.id, j.job.lease],
  );
  await as(owner, "SELECT venue_email_toggle($1,$2,true)", [venue, c.version]);
  return c;
}
async function subscribe() {
  await as(player, "SELECT venue_email_preference($1,true)", [group]);
}
async function send(request = id(20)) {
  const p = (await as(owner, "SELECT venue_email_preview($1) p", [venue]))[0].p;
  return (
    await as(
      owner,
      "SELECT venue_email_campaign_send($1,NULL,$2,$3,$4,$5) id",
      [venue, "Come play", "Session details", p.fingerprint, request],
    )
  )[0].id;
}
beforeAll(async () => {
  db = await venueSuiteDatabase();
  await db.exec(`ALTER TABLE auth.users ADD COLUMN email text,ADD COLUMN email_confirmed_at timestamptz;
 ALTER TABLE venues ADD COLUMN address text,ADD COLUMN logo_url text,ADD COLUMN primary_color text;
 ALTER TABLE notification_preferences ADD COLUMN email_enabled boolean;
 CREATE TABLE suppressed_emails(email text);
 CREATE SCHEMA vault; CREATE TABLE vault.secrets(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),secret text,name text);
 CREATE VIEW vault.decrypted_secrets AS SELECT id,secret AS decrypted_secret FROM vault.secrets;
 CREATE FUNCTION vault.create_secret(text,text) RETURNS uuid LANGUAGE plpgsql AS $$ DECLARE v uuid;BEGIN INSERT INTO vault.secrets(secret,name) VALUES($1,$2) RETURNING id INTO v;RETURN v;END $$;
 CREATE FUNCTION vault.update_secret(uuid,text) RETURNS void LANGUAGE sql AS $$ UPDATE vault.secrets SET secret=$2 WHERE id=$1 $$;`);
  await db.exec(
    readFileSync(
      "supabase/migrations/20260929235000_venue_email_integrations.sql",
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/20260929235800_venue_email_mfa_policies.sql",
      "utf8",
    ),
  );
}, 30000);
beforeEach(async () => {
  await db.exec(
    "TRUNCATE venues,auth.users,groups,group_members,venue_staff,notification_preferences,group_notification_prefs,suppressed_emails,vault.secrets CASCADE; SELECT set_config('test.mfa_required','',false)",
  );
  await db.query(
    "INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,'owner@venue.test',now()),($2,'player@example.test',now()),($3,'other@example.test',now()),($4,'staff@example.test',now())",
    [owner, player, other, staff],
  );
  await db.query(
    "INSERT INTO venues(id,name,owner_id,is_active,verification_approved_at,address) VALUES($1,'Rally Haus',$2,true,now(),'123 Court St')",
    [venue, owner],
  );
  await db.query("INSERT INTO groups(id,venue_id) VALUES($1,$2)", [
    group,
    venue,
  ]);
  await db.query(
    "INSERT INTO group_members(group_id,user_id,status) VALUES($1,$2,'active')",
    [group, player],
  );
  await db.query(
    "INSERT INTO venue_staff VALUES($1,$2,true,'active','staff')",
    [venue, staff],
  );
});
afterAll(() => db?.close());
it("isolates settings, keys and outbox from guests, players and desk staff", async () => {
  await save();
  const w = await workspace();
  expect(w.connection.provider).toBe("resend");
  expect(JSON.stringify(w)).not.toMatch(/credential|secret_id/);
  for (const user of [player, other, staff])
    await expect(
      as(user, "SELECT venue_email_workspace($1)", [venue]),
    ).rejects.toThrow(/management access/);
  for (const table of [
    "venue_email_connections",
    "venue_email_outbox",
    "venue_email_preferences",
    "venue_email_campaigns",
  ])
    await expect(as(owner, `SELECT * FROM ${table}`)).rejects.toThrow(
      /permission denied/,
    );
  await expect(as(owner, "SELECT venue_email_claim()")).rejects.toThrow(
    /permission denied/,
  );
  await db.exec("SELECT set_config('test.mfa_required','unverified',false)");
  await expect(workspace()).rejects.toThrow(/management access/);
});
it("meets the production MFA policy invariant for all four private email tables", async () => {
  const rows = (
    await db.query<{ table_name: string }>(`SELECT c.relname AS table_name
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname IN ('venue_email_connections','venue_email_preferences','venue_email_campaigns','venue_email_outbox')
    AND (NOT c.relrowsecurity OR NOT EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid=c.oid AND p.polname='pulse_required_mfa' AND NOT p.polpermissive))`)
  ).rows;
  expect(rows).toEqual([]);
});
it("rejects cross-venue, unverified and sample connections and untested activation", async () => {
  await expect(
    service("SELECT venue_email_save($1,$2,NULL,$3,$4)", [
      venue,
      other,
      config,
      "re_test_credential_not_real",
    ]),
  ).rejects.toThrow(/management required/);
  await db.query(
    "UPDATE venues SET verification_approved_at=NULL WHERE id=$1",
    [venue],
  );
  await expect(save()).rejects.toThrow(/management required/);
  await db.query(
    "UPDATE venues SET verification_approved_at=now() WHERE id=$1",
    [venue],
  );
  await save();
  const c = (await workspace()).connection;
  await expect(
    as(owner, "SELECT venue_email_toggle($1,$2,true)", [venue, c.version]),
  ).rejects.toThrow(/successful test/);
  await db.query("INSERT INTO private_venue_sandboxes(venue_id) VALUES($1)", [
    venue,
  ]);
  await expect(save(c.version)).rejects.toThrow(/management required/);
});
it("rotates credentials without exposing them, detects stale settings, and invalidates testing", async () => {
  const c = await ready();
  await save(c.version, "re_changed_credential_not_real");
  const next = (await workspace()).connection;
  expect(next.version).not.toBe(c.version);
  expect(next.tested_at).toBeNull();
  expect(next.enabled).toBe(false);
  expect((await db.query("SELECT * FROM vault.secrets")).rows).toHaveLength(1);
  await expect(save(c.version)).rejects.toThrow(/Settings changed/);
  await service("SELECT venue_email_disconnect($1,$2,$3)", [
    venue,
    owner,
    next.version,
  ]);
  expect((await workspace()).connection).toBeNull();
  expect((await db.query("SELECT * FROM vault.secrets")).rows).toHaveLength(0);
});
it("sends a test only to the authenticated manager and safely retries a repeated request", async () => {
  await save();
  const c = (await workspace()).connection;
  for (let n = 0; n < 2; n++)
    await service("SELECT venue_email_test($1,$2,$3,$4)", [
      venue,
      owner,
      c.version,
      id(10),
    ]);
  expect(
    (await db.query<any>("SELECT * FROM venue_email_outbox")).rows,
  ).toMatchObject([{ recipient_email: "owner@venue.test", kind: "test" }]);
  await expect(
    service("SELECT venue_email_test($1,$2,$3,$4)", [
      venue,
      player,
      c.version,
      id(11),
    ]),
  ).rejects.toThrow(/management required/);
});
it("requires explicit subscriptions and respects global opt-out, verification, and suppression", async () => {
  await ready();
  expect(
    (await as(owner, "SELECT venue_email_preview($1) p", [venue]))[0].p.count,
  ).toBe(0);
  await subscribe();
  expect(
    (await as(owner, "SELECT venue_email_preview($1) p", [venue]))[0].p.count,
  ).toBe(1);
  await db.query(
    "INSERT INTO notification_preferences(user_id,category,email_enabled) VALUES($1,'community',false)",
    [player],
  );
  expect(
    (await as(owner, "SELECT venue_email_preview($1) p", [venue]))[0].p.count,
  ).toBe(0);
  await db.exec("TRUNCATE notification_preferences");
  await db.query("INSERT INTO suppressed_emails VALUES('PLAYER@example.test')");
  expect(
    (await as(owner, "SELECT venue_email_preview($1) p", [venue]))[0].p.count,
  ).toBe(0);
  await db.exec("TRUNCATE suppressed_emails");
  await db.query("UPDATE auth.users SET email_confirmed_at=NULL WHERE id=$1", [
    player,
  ]);
  expect(
    (await as(owner, "SELECT venue_email_preview($1) p", [venue]))[0].p.count,
  ).toBe(0);
});
it("supports sender testing before a community exists and enforces the hourly test limit", async () => {
  await db.exec("TRUNCATE groups CASCADE");
  await save();
  const c = (await workspace()).connection;
  for (let n = 30; n < 35; n++)
    await service("SELECT venue_email_test($1,$2,$3,$4)", [
      venue,
      owner,
      c.version,
      id(n),
    ]);
  expect(
    (await db.query<any>("SELECT venue_url FROM venue_email_outbox LIMIT 1"))
      .rows[0].venue_url,
  ).toBe("https://pulsepb.com/player/community");
  await expect(
    service("SELECT venue_email_test($1,$2,$3,$4)", [
      venue,
      owner,
      c.version,
      id(35),
    ]),
  ).rejects.toThrow(/Five test emails/);
  await service("SELECT venue_email_test($1,$2,$3,$4)", [
    venue,
    owner,
    c.version,
    id(30),
  ]);
  expect(
    (await db.query("SELECT id FROM venue_email_outbox")).rows,
  ).toHaveLength(5);
});
it("expires old queued work and cancels messages when the sending manager loses access", async () => {
  await ready();
  await subscribe();
  await send();
  await db.exec(
    "UPDATE venue_email_outbox SET created_at=now()-interval '25 hours' WHERE kind='announcement'",
  );
  expect((await service("SELECT venue_email_claim() c"))[0].c).toBeNull();
  await send(id(21));
  await db.query("UPDATE venues SET owner_id=$1 WHERE id=$2", [other, venue]);
  expect((await service("SELECT venue_email_claim() c"))[0].c).toBeNull();
  expect(
    (
      await db.query<any>(
        "SELECT status FROM venue_email_outbox WHERE kind='announcement'",
      )
    ).rows,
  ).toEqual([{ status: "canceled" }, { status: "canceled" }]);
});
it("queues one campaign across retries and rechecks consent immediately before dispatch", async () => {
  await ready();
  await subscribe();
  const campaign = await send();
  expect(await send()).toBe(campaign);
  expect(
    (await db.query("SELECT * FROM venue_email_campaigns")).rows,
  ).toHaveLength(1);
  await as(player, "SELECT venue_email_preference($1,false)", [group]);
  expect((await service("SELECT venue_email_claim() c"))[0].c).toEqual({
    skipped: true,
  });
  expect(
    (
      await db.query<any>(
        "SELECT status FROM venue_email_outbox WHERE kind='announcement'",
      )
    ).rows[0].status,
  ).toBe("suppressed");
});
it("rejects stale audiences, foreign events and unsafe headers", async () => {
  await ready();
  await subscribe();
  const p = (await as(owner, "SELECT venue_email_preview($1) p", [venue]))[0].p;
  await as(player, "SELECT venue_email_preference($1,false)", [group]);
  await expect(
    as(owner, "SELECT venue_email_campaign_send($1,NULL,$2,$3,$4,$5)", [
      venue,
      "News",
      "Body",
      p.fingerprint,
      id(22),
    ]),
  ).rejects.toThrow(/Preview/);
  await expect(
    as(owner, "SELECT venue_email_preview($1,$2)", [venue, id(99)]),
  ).rejects.toThrow(/active event/);
  await expect(
    as(owner, "SELECT venue_email_campaign_send($1,NULL,$2,$3,$4,$5)", [
      venue,
      "Bad\r\nBcc: x",
      "Body",
      p.fingerprint,
      id(23),
    ]),
  ).rejects.toThrow(/subject/);
});
it("pauses queued messages and cancels them on sender changes", async () => {
  const c = await ready();
  await subscribe();
  await send();
  await as(owner, "SELECT venue_email_toggle($1,$2,false)", [venue, c.version]);
  expect((await service("SELECT venue_email_claim() c"))[0].c).toBeNull();
  await save(c.version, null);
  expect(
    (
      await db.query<any>(
        "SELECT status FROM venue_email_outbox WHERE kind='announcement'",
      )
    ).rows[0].status,
  ).toBe("canceled");
});
it("fences delivery leases and never automatically resends an uncertain attempt", async () => {
  await ready();
  await subscribe();
  await send();
  const c = (await service("SELECT venue_email_claim() c"))[0].c;
  expect((await service("SELECT venue_email_claim() c"))[0].c).toBeNull();
  await expect(
    service("SELECT venue_email_finish($1,$2,'accepted')", [c.job.id, id(99)]),
  ).rejects.toThrow(/lease/);
  await db.query(
    "UPDATE venue_email_outbox SET lease_until=now()-interval '1 second' WHERE id=$1",
    [c.job.id],
  );
  expect((await service("SELECT venue_email_claim() c"))[0].c).toBeNull();
  expect(
    (
      await db.query<any>("SELECT status FROM venue_email_outbox WHERE id=$1", [
        c.job.id,
      ])
    ).rows[0].status,
  ).toBe("unknown");
});
it("accepts one-click unsubscribe only for its recipient and venue", async () => {
  await ready();
  await subscribe();
  await send();
  const j = (
    await db.query<any>(
      "SELECT * FROM venue_email_outbox WHERE kind='announcement'",
    )
  ).rows[0];
  expect(
    (
      await as(null, "SELECT venue_email_unsubscribe($1) ok", [id(99)], "anon")
    )[0].ok,
  ).toBe(false);
  expect(
    (
      await as(
        null,
        "SELECT venue_email_unsubscribe($1) ok",
        [j.unsubscribe_token],
        "anon",
      )
    )[0].ok,
  ).toBe(true);
  expect(
    (await as(player, "SELECT venue_email_preference($1) p", [group]))[0].p
      .subscribed,
  ).toBe(false);
  expect(
    (
      await db.query<any>("SELECT status FROM venue_email_outbox WHERE id=$1", [
        j.id,
      ])
    ).rows[0].status,
  ).toBe("suppressed");
});
