import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

// Execute the production migration in real, in-memory PostgreSQL. Only auth
// and notification-delivery dependencies are local fixtures; no live users,
// service credentials, emails, or push notifications are involved.
const migrations = resolve(__dirname, "../../supabase/migrations");
const read = (file: string) => readFileSync(resolve(migrations, file), "utf8");
const migration = read("20260913100000_consistent_friend_connections.sql");
const original = read(
  "20260130233055_2617c20c-4407-4b1d-a658-4e4cc4359fdb.sql"
);
const safety = read("20260620014248_ef1295ad-c3ce-49e0-a2c4-0338404728d8.sql");
const a = "10000000-0000-0000-0000-000000000001";
const b = "10000000-0000-0000-0000-000000000002";
const c = "10000000-0000-0000-0000-000000000003";
let db: PGlite;

async function asUser<T = Record<string, unknown>>(
  id: string,
  sql: string,
  params: unknown[] = []
) {
  await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [id]);
  await db.exec("SET ROLE authenticated");
  try {
    return await db.query<T>(sql, params);
  } finally {
    await db.exec("RESET ROLE");
    await db.query("SELECT set_config('request.jwt.claim.sub', '', false)");
  }
}
const send = (from = a, to = b) =>
  asUser<{ status: string }>(
    from,
    "SELECT public.send_friend_request($1) AS status",
    [to]
  );
const count = async (table = "friendships") =>
  (
    await db.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM public.${table}`
    )
  ).rows[0].count;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO authenticated, anon;
    CREATE TABLE public.profiles (id uuid PRIMARY KEY REFERENCES auth.users(id), display_name text, full_name text);
    CREATE TABLE public.user_notifications (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, notification_type text,
      category text, title text, message text, link text, actor_id uuid, metadata jsonb, read boolean DEFAULT false
    );
    CREATE FUNCTION public.notif_actor_name(p_user_id uuid) RETURNS text LANGUAGE sql STABLE AS $$ SELECT 'Test player'::text $$;
    CREATE FUNCTION public.enqueue_notification(p_user_id uuid, p_type text, p_category text, p_title text,
      p_message text, p_link text DEFAULT NULL, p_actor_id uuid DEFAULT NULL, p_metadata jsonb DEFAULT '{}')
      RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
      INSERT INTO public.user_notifications (user_id, notification_type, category, title, message, link, actor_id, metadata)
      VALUES (p_user_id, p_type, p_category, p_title, p_message, p_link, p_actor_id, p_metadata) $$;
  `);
  await db.exec(
    original.slice(0, original.indexOf("-- Create conversations table"))
  );
  await db.exec(
    "ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY; GRANT SELECT, INSERT, UPDATE, DELETE ON public.friendships TO authenticated;"
  );
  await db.exec(
    original.slice(
      original.indexOf("-- Friendships RLS Policies"),
      original.indexOf("-- Conversations RLS Policies")
    )
  );
  await db.exec(safety.slice(0, safety.indexOf("-- 2. message_reports")));
  const blockFunction = safety.slice(
    safety.indexOf("CREATE OR REPLACE FUNCTION public.is_blocked_between")
  );
  await db.exec(
    blockFunction.slice(
      0,
      blockFunction.indexOf("$$;", blockFunction.indexOf("AS $$")) + 3
    )
  );
  await db.exec(migration);
  await db.exec(migration); // Safe to copy/paste again.
  await db.exec(`
    CREATE TRIGGER trg_notify_friendship_insert AFTER INSERT ON public.friendships
      FOR EACH ROW EXECUTE FUNCTION public.notify_friendship_event();
    CREATE TRIGGER trg_notify_friendship_update AFTER UPDATE ON public.friendships
      FOR EACH ROW EXECUTE FUNCTION public.notify_friendship_event();
    INSERT INTO auth.users VALUES ('${a}'), ('${b}'), ('${c}');
    INSERT INTO public.profiles (id) SELECT id FROM auth.users;
  `);
}, 30_000);
beforeEach(async () => {
  await db.exec(
    "TRUNCATE public.friendships, public.user_blocks, public.user_notifications"
  );
});
afterAll(async () => {
  await db?.close();
});

describe("friend request consent and lifecycle", () => {
  it("sends once, is idempotent, and deep-links the receiver to Requests", async () => {
    expect((await send()).rows[0].status).toBe("pending");
    expect((await send()).rows[0].status).toBe("pending");
    expect(await count()).toBe(1);
    const notifications = await db.query<{ link: string; user_id: string }>(
      "SELECT link, user_id FROM user_notifications"
    );
    expect(notifications.rows).toEqual([
      { link: "/player/friends?tab=requests", user_id: b },
    ]);
  });
  it("accepts reciprocal requests instead of creating duplicates", async () => {
    await send();
    expect((await send(b, a)).rows[0].status).toBe("accepted");
    expect(await count()).toBe(1);
    expect(
      (
        await db.query<{ read: boolean }>(
          "SELECT read FROM user_notifications WHERE notification_type = 'friend_request_received'"
        )
      ).rows[0].read
    ).toBe(true);
  });
  it("lets only the recipient accept, including RETURNING used by the app", async () => {
    await send();
    expect(
      (
        await asUser(
          a,
          "UPDATE friendships SET status = 'accepted' RETURNING id"
        )
      ).rows
    ).toEqual([]);
    expect(
      (
        await asUser(
          c,
          "UPDATE friendships SET status = 'accepted' RETURNING id"
        )
      ).rows
    ).toEqual([]);
    expect(
      (
        await asUser(
          b,
          "UPDATE friendships SET status = 'accepted' WHERE status = 'pending' RETURNING id, accepted_at"
        )
      ).rows
    ).toHaveLength(1);
  });
  it("rejects direct accepted inserts and participant rewrites", async () => {
    await expect(
      asUser(
        a,
        "INSERT INTO friendships (user_id, friend_id, status) VALUES ($1,$2,'accepted')",
        [a, b]
      )
    ).rejects.toThrow();
    await send();
    await expect(
      asUser(b, "UPDATE friendships SET status = 'accepted', user_id = $1", [c])
    ).rejects.toThrow("participants cannot be changed");
    await expect(
      asUser(
        b,
        "UPDATE friendships SET status = 'accepted', id = gen_random_uuid()"
      )
    ).rejects.toThrow("participants cannot be changed");
  });
  it("keeps legacy pending inserts compatible but refuses a second directional row", async () => {
    await asUser(
      a,
      "INSERT INTO friendships (user_id,friend_id) VALUES ($1,$2)",
      [a, b]
    );
    await expect(
      asUser(b, "INSERT INTO friendships (user_id,friend_id) VALUES ($1,$2)", [
        b,
        a,
      ])
    ).rejects.toThrow("already exists");
    expect(await count()).toBe(1);
  });
  it("validates targets and unauthenticated calls", async () => {
    await expect(send(a, a)).rejects.toThrow("Invalid player");
    await expect(
      send(a, "10000000-0000-0000-0000-000000000099")
    ).rejects.toThrow("not available");
    await expect(
      db.query("SELECT public.send_friend_request($1)", [b])
    ).rejects.toThrow("Authentication required");
    await db.exec("SET ROLE anon");
    try {
      await expect(
        db.query("SELECT public.send_friend_request($1)", [b])
      ).rejects.toThrow("permission denied");
    } finally {
      await db.exec("RESET ROLE");
    }
  });
  it.each([a, b])(
    "allows %s to resolve a pending request and clears its stale notification",
    async (actor) => {
      await send();
      expect(
        (
          await asUser(
            actor,
            "DELETE FROM friendships WHERE status = 'pending' RETURNING id"
          )
        ).rows
      ).toHaveLength(1);
      expect(
        (
          await db.query<{ read: boolean }>(
            "SELECT read FROM user_notifications"
          )
        ).rows[0].read
      ).toBe(true);
    }
  );
  it("a stale cancel cannot remove a just-accepted friendship", async () => {
    await send();
    await send(b, a);
    expect(
      (
        await asUser(
          a,
          "DELETE FROM friendships WHERE status = 'pending' RETURNING id"
        )
      ).rows
    ).toEqual([]);
    expect(await count()).toBe(1);
    expect(
      (
        await asUser(
          a,
          "DELETE FROM friendships WHERE status = 'accepted' RETURNING id"
        )
      ).rows
    ).toHaveLength(1);
  });
});

describe("atomic blocks", () => {
  it("blocking removes an existing connection and blocks requests both ways", async () => {
    await send();
    await send(b, a);
    await asUser(a, "SELECT public.block_player($1)", [b]);
    await asUser(a, "SELECT public.block_player($1)", [b]);
    expect(await count()).toBe(0);
    expect(await count("user_blocks")).toBe(1);
    await expect(send()).rejects.toThrow("not available");
    await expect(send(b, a)).rejects.toThrow("not available");
    await expect(
      asUser(b, "INSERT INTO friendships (user_id,friend_id) VALUES ($1,$2)", [
        b,
        a,
      ])
    ).rejects.toThrow("not available");
  });
  it("also disconnects atomically for older clients that insert user_blocks directly", async () => {
    await send();
    await asUser(
      b,
      "INSERT INTO user_blocks (blocker_id,blocked_id) VALUES ($1,$2)",
      [b, a]
    );
    expect(await count()).toBe(0);
    expect(
      (await db.query<{ read: boolean }>("SELECT read FROM user_notifications"))
        .rows[0].read
    ).toBe(true);
  });
  it("only the blocker can unblock, and unblocking does not auto-restore friendship", async () => {
    await asUser(a, "SELECT public.block_player($1)", [b]);
    expect(
      (await asUser(b, "DELETE FROM user_blocks RETURNING id")).rows
    ).toEqual([]);
    await asUser(a, "DELETE FROM user_blocks");
    expect(await count()).toBe(0);
    expect((await send()).rows[0].status).toBe("pending");
  });
  it("rejects blocks on behalf of another person", async () => {
    await send();
    await expect(
      asUser(
        c,
        "INSERT INTO user_blocks (blocker_id,blocked_id) VALUES ($1,$2)",
        [a, b]
      )
    ).rejects.toThrow();
    expect(await count()).toBe(1);
    expect(await count("user_blocks")).toBe(0);
  });
  it("does not disclose other players’ friend lists through RLS", async () => {
    await send();
    expect((await asUser(c, "SELECT * FROM friendships")).rows).toEqual([]);
  });
});
