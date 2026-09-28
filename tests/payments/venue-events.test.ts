import { readFileSync } from "node:fs";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  assertCheckoutMatches,
  assertPaymentConfiguration,
  billingMode,
  MODULE_AMOUNT_CENTS,
  MODULE_BILLING_TERMS,
  moduleName,
  moneyInput,
  uuid,
} from "../../supabase/functions/_shared/payment-contracts";

const id = (n: number) =>
  `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const buyer = id(1),
  other = id(2),
  owner = id(3),
  venue = id(4),
  group = id(5),
  court = id(6),
  secondCourt = id(7);
const start = "2099-06-08T10:00:00Z",
  end = "2099-06-08T11:30:00Z";
const policy = "Cancel at least 24 hours before play for a full refund.";
let db: PGlite;
let tomorrow: string, later: string;
async function asUser(user: string, query: string, args: unknown[] = []) {
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [user]);
  await db.exec("SET ROLE authenticated");
  try {
    return await db.query(query, args);
  } finally {
    await db.exec(
      "RESET ROLE; SELECT set_config('request.jwt.claim.sub','',false)"
    );
  }
}
async function reserve(
  user = buyer,
  live = true,
  request = id(10),
  expected = 3000,
  acceptedPolicy = policy
) {
  return (
    await db.query<any>(
      "SELECT * FROM payment_reserve_court($1,$2,$3,$4,$5,$6,$7,$8,$9)",
      [
        user,
        group,
        court,
        tomorrow,
        later,
        live,
        expected,
        acceptedPolicy,
        request,
      ]
    )
  ).rows[0];
}
async function apply(
  order: any,
  status = "paid",
  changes: Record<string, unknown> = {}
) {
  const values = {
    account: "acct_venue",
    live: order.livemode,
    session: "cs_test_valid",
    amount: order.amount_cents,
    currency: "usd",
    intent: "pi_valid",
    customer: "cus_buyer",
    subscription: null,
    through: null,
    ...changes,
  };
  return (
    await db.query<any>(
      "SELECT * FROM payment_apply_result($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
      [
        order.id,
        values.account,
        values.live,
        values.session,
        status,
        values.amount,
        values.currency,
        values.intent,
        values.customer,
        values.subscription,
        values.through,
      ]
    )
  ).rows[0];
}
beforeAll(async () => {
  db = new PGlite({ extensions: { btree_gist } });
  await db.exec(`CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role BYPASSRLS; CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth,public TO authenticated,anon,service_role;
    CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE TABLE profiles(id uuid PRIMARY KEY,additional_league_slots integer DEFAULT 0);
    CREATE TABLE league_slot_purchases(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,stripe_session_id text UNIQUE,stripe_customer_id text,amount_cents integer,currency text,slots_granted integer,status text,created_at timestamptz DEFAULT now(),fulfilled_at timestamptz);
    CREATE FUNCTION increment_league_slots(uuid,integer) RETURNS integer LANGUAGE plpgsql AS $$ DECLARE total integer; BEGIN UPDATE profiles SET additional_league_slots=additional_league_slots+$2 WHERE id=$1 RETURNING additional_league_slots INTO total; IF total IS NULL THEN RAISE EXCEPTION 'Missing profile'; END IF; RETURN total; END $$;
    CREATE TABLE venues(id uuid PRIMARY KEY,name text,owner_id uuid,is_active bool,verification_approved_at timestamptz,hours_of_operation jsonb);
    CREATE TABLE groups(id uuid PRIMARY KEY,venue_id uuid);
    CREATE TABLE group_members(group_id uuid,user_id uuid,status text);
    CREATE TABLE venue_staff(venue_id uuid,user_id uuid,is_active boolean,status text,role text);
    CREATE TABLE venue_courts(id uuid PRIMARY KEY,venue_id uuid,name text,is_active bool,hourly_rate numeric);
    CREATE TABLE group_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),group_id uuid,venue_id uuid,venue_court_id uuid,created_by uuid,title text,start_time timestamptz,end_time timestamptz,event_format text,location_type text);
    CREATE TABLE venue_module_access(venue_id uuid,module_key text,source text,enabled bool,expires_at timestamptz,updated_at timestamptz DEFAULT now(),PRIMARY KEY(venue_id,module_key));
    CREATE FUNCTION venue_has_module(uuid,text) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$ SELECT EXISTS(SELECT 1 FROM venue_module_access WHERE venue_id=$1 AND module_key=$2 AND enabled AND (expires_at IS NULL OR expires_at>now())) $$;
    GRANT SELECT ON venues,groups,group_members,venue_courts TO authenticated;
    GRANT ALL ON group_events TO authenticated,service_role;
  `);
  await db.exec(
    readFileSync(
      "supabase/migrations/20260918100000_payment_foundation.sql",
      "utf8"
    )
  );
  await db.exec(
    "CREATE TRIGGER guard_venue_event_module BEFORE INSERT OR UPDATE ON group_events FOR EACH ROW EXECUTE FUNCTION guard_venue_module_write()"
  );
  await db.exec(
    "ALTER TABLE venues ADD COLUMN community_model text DEFAULT 'existing'"
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/20260919100000_eleveno_free_tier_and_upgrade_reactivation.sql",
      "utf8"
    )
  );
  await db.exec(
    "ALTER TABLE venues ADD COLUMN stripe_account_id text; ALTER TABLE venues ADD COLUMN timezone text; CREATE TABLE private_venue_sandboxes(venue_id uuid PRIMARY KEY REFERENCES venues(id),owner_id uuid,group_id uuid);"
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/20260921100000_venue_stripe_readiness.sql",
      "utf8"
    )
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/20260921110000_private_venue_test_payments.sql",
      "utf8"
    )
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/20260921120000_refund_failure_recovery.sql",
      "utf8"
    )
  );
  for (const table of [
    "venue_payment_accounts",
    "venue_payment_settings",
    "payment_orders",
    "payment_subscriptions",
  ]) {
    await db.exec(
      `CREATE TRIGGER guard_private_sandbox BEFORE INSERT OR UPDATE ON ${table} FOR EACH ROW EXECUTE FUNCTION guard_private_venue_sandbox()`
    );
  }
  await db.exec(`
    ALTER TABLE groups ADD COLUMN visibility text DEFAULT 'public', ADD COLUMN created_by uuid;
    ALTER TABLE group_members ADD COLUMN role text DEFAULT 'member';
    ALTER TABLE venue_courts ADD COLUMN court_number integer;
    ALTER TABLE group_events ADD COLUMN description text, ADD COLUMN custom_location text, ADD COLUMN parent_event_id uuid REFERENCES group_events ON DELETE CASCADE,
      ADD COLUMN capacity integer, ADD COLUMN skill_level_min numeric, ADD COLUMN skill_level_max numeric, ADD COLUMN rotation_style text,
      ADD COLUMN waitlist_enabled boolean DEFAULT false, ADD COLUMN waitlist_limit integer, ADD COLUMN is_recurring boolean, ADD COLUMN recurring_rule text, ADD COLUMN series_id uuid,
      ADD COLUMN rr_courts integer, ADD COLUMN rr_games_per_player integer, ADD COLUMN updated_at timestamptz DEFAULT now(),ADD COLUMN created_at timestamptz DEFAULT now();
    CREATE TABLE group_event_rsvps(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),event_id uuid REFERENCES group_events ON DELETE CASCADE,user_id uuid,status text,waitlist_position integer,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),UNIQUE(event_id,user_id));
    CREATE FUNCTION pulse_has_required_mfa() RETURNS boolean LANGUAGE sql AS $$ SELECT coalesce(current_setting('test.mfa_required',true),'')<>'unverified' $$;
    CREATE TABLE group_notification_prefs(group_id uuid,user_id uuid,muted_all boolean,events boolean);
    CREATE TABLE change_notifications(user_id uuid,title text);
    CREATE FUNCTION enqueue_notification(uuid,text,text,text,text,text,uuid,jsonb) RETURNS void LANGUAGE sql AS $$ INSERT INTO change_notifications VALUES($1,$4) $$;
    CREATE VIEW profiles_public AS SELECT id,'Alex'::text first_name,'Surname'::text last_name,'Alex Surname'::text full_name FROM auth.users;
    CREATE FUNCTION is_group_member(uuid,uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT EXISTS(SELECT 1 FROM group_members WHERE user_id=$1 AND group_id=$2 AND status='active') $$;
    CREATE FUNCTION promote_group_event_waitlist(uuid) RETURNS integer LANGUAGE sql AS $$ SELECT 0 $$;
    CREATE FUNCTION notify_group_event_new() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$;
    GRANT ALL ON group_event_rsvps TO authenticated,service_role;
  `);
  for (const migration of [
    "20260904100000_venue_court_reservations.sql",
    "20260928190000_atomic_venue_program_courts.sql",
    "20260928210000_venue_event_management.sql",
    "20260928211000_venue_event_payments.sql",
    "20260928212000_venue_event_operations.sql",
    "20260928213000_venue_event_draft_mfa.sql",
  ])
    await db.exec(readFileSync("supabase/migrations/" + migration, "utf8"));
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 2);
  d.setUTCHours(10, 0, 0, 0);
  tomorrow = d.toISOString();
  later = new Date(d.getTime() + 90 * 60000).toISOString();
}, 30_000);
beforeEach(async () => {
  await db.exec(
    "TRUNCATE profiles,league_slot_purchases,payment_cancellation_requests,payment_webhook_events,payment_subscriptions,group_events,payment_orders,payment_customers,venue_payment_accounts,venue_payment_settings,venue_module_access,group_members,groups,venue_courts,venues,auth.users CASCADE"
  );
  await db.query("INSERT INTO auth.users VALUES($1),($2),($3)", [
    buyer,
    other,
    owner,
  ]);
  await db.query(
    "INSERT INTO venues(id,name,owner_id,is_active,verification_approved_at,hours_of_operation) VALUES($1,'ELEVENO Test',$2,true,now(),NULL)",
    [venue, owner]
  );
  await db.query("INSERT INTO groups(id,venue_id) VALUES($1,$2)", [
    group,
    venue,
  ]);
  await db.query(
    "INSERT INTO group_members(group_id,user_id,status) VALUES($1,$2,'active'),($1,$3,'active')",
    [group, buyer, other]
  );
  await db.query(
    "INSERT INTO venue_courts(id,venue_id,name,is_active,hourly_rate) VALUES($1,$2,'Court 1',true,20),($3,$2,'Court 2',true,30)",
    [court, venue, secondCourt]
  );
  await db.query(
    "INSERT INTO venue_module_access VALUES($1,'court_booking','existing_venue',true,NULL,now())",
    [venue]
  );
  await db.query(
    "INSERT INTO venue_payment_settings(venue_id,accepting_payments,cancellation_policy,support_email,timezone,tax_inclusive_acknowledged,updated_at) VALUES($1,true,$2,'venue@example.com','UTC',true,now())",
    [venue, policy]
  );
  await db.query(
    "INSERT INTO venue_payment_accounts(venue_id,livemode,account_id,connected_by,charges_enabled,payouts_enabled,details_submitted,card_payments_active) VALUES($1,true,'acct_venue',$2,true,true,true,true),($1,false,'acct_venue',$2,true,true,true,true)",
    [venue, owner]
  );
  await db.query(
    "INSERT INTO venue_module_access VALUES($1,'facility_tools','existing_venue',true,NULL,now())",
    [venue]
  );
  await db.exec(
    "UPDATE venue_payment_settings SET accepting_event_payments=true"
  );
});
afterAll(async () => {
  await db?.close();
});

const doc = () => ({
  title: "Evening clinic",
  description: "Coached skills and match play",
  event_format: "clinic",
  capacity: 2,
  waitlist_enabled: true,
  price_cents: 2000,
  court_ids: [court],
  occurrences: [{ start_time: tomorrow, end_time: later }],
  close_minutes: 0,
});
async function draft(document = doc()) {
  return (
    await asUser(
      owner,
      "SELECT * FROM save_venue_event_draft($1,$2,NULL,$3,NULL)",
      [venue, group, JSON.stringify(document)]
    )
  ).rows[0] as any;
}
async function publish(d: any) {
  return (
    (
      await asUser(owner, "SELECT publish_venue_event_draft($1,$2) ids", [
        d.id,
        d.updated_at,
      ])
    ).rows[0] as any
  ).ids as string[];
}
async function event(price = 2000) {
  return (await publish(await draft({ ...doc(), price_cents: price })))[0];
}
async function book(e: string, user = buyer, live = true, request = id(90)) {
  return (
    await db.query<any>(
      "SELECT * FROM payment_reserve_event($1,$2,$3,2000,$4,$5)",
      [user, e, live, policy, request]
    )
  ).rows[0];
}
async function rsvps(e: string) {
  return (
    await db.query<any>("SELECT * FROM group_event_rsvps WHERE event_id=$1", [
      e,
    ])
  ).rows;
}
it("drafts stay off the calendar; publish is atomic, idempotent and reserves selected courts only", async () => {
  const d = await draft();
  expect((await db.query("SELECT * FROM group_events")).rows).toHaveLength(0);
  const ids = await publish(d);
  expect(await publish(d)).toEqual(ids);
  expect((await db.query("SELECT * FROM group_events")).rows).toHaveLength(2);
  const conflicts = await draft();
  await expect(publish(conflicts)).rejects.toMatchObject({ code: "23P01" });
  expect((await db.query("SELECT * FROM group_events")).rows).toHaveLength(2);
  await expect(
    asUser(buyer, "SELECT * FROM save_venue_event_draft($1,$2,NULL,$3,NULL)", [
      venue,
      group,
      JSON.stringify(doc()),
    ])
  ).rejects.toThrow("access required");
});
it("holds places through checkout, rejects stale prices and direct RSVP bypass, fulfills only verified live payments", async () => {
  const e = await event();
  const o = await book(e);
  expect((await book(e)).id).toBe(o.id);
  await expect(
    db.query(
      "INSERT INTO group_event_rsvps(event_id,user_id,status) VALUES($1,$2,'going')",
      [e, buyer]
    )
  ).rejects.toThrow("secure checkout");
  await expect(
    db.query("SELECT * FROM payment_reserve_event($1,$2,true,100,$3,$4)", [
      other,
      e,
      policy,
      id(91),
    ])
  ).rejects.toThrow("price or policy changed");
  await book(e, other, true, id(92));
  await expect(
    db.query("SELECT payment_event_quote($1,$2,true)", [owner, e])
  ).rejects.toThrow();
  await expect(apply(o, "paid", { amount: 1 })).rejects.toThrow();
  expect(await rsvps(e)).toHaveLength(0);
  await apply(o, "paid", { intent: "pi_event", session: "cs_event" });
  await apply(o, "paid", { intent: "pi_event", session: "cs_event" });
  expect(await rsvps(e)).toMatchObject([
    { status: "going", payment_order_id: o.id },
  ]);
  await expect(
    asUser(
      buyer,
      "UPDATE group_event_rsvps SET status='not_going' WHERE event_id=$1",
      [e]
    )
  ).rejects.toThrow("Payments");
  await expect(
    asUser(buyer, "SELECT payment_event_quote($1,$2,true)", [buyer, e])
  ).rejects.toThrow("permission");
});
it("test payments never create registrations and verified expiry releases a hold", async () => {
  const e = await event();
  const o = await book(e, buyer, false);
  await apply(o);
  expect(await rsvps(e)).toHaveLength(0);
  const live = await book(e, buyer, true, id(91));
  await apply(live, "expired", { intent: null, session: null });
  expect(
    (
      await db.query<any>("SELECT payment_event_quote($1,$2,true) q", [
        buyer,
        e,
      ])
    ).rows[0].q.spots_left
  ).toBe(2);
});
it("cancellation preserves history, releases all courts, and queues a late payment for refund review", async () => {
  const e = await event();
  const o = await book(e);
  const before = (
    await db.query<any>("SELECT * FROM group_events WHERE id=$1", [e])
  ).rows[0];
  await asUser(owner, "SELECT cancel_venue_program($1,$2,$3)", [
    e,
    before.updated_at,
    "Facility closed for maintenance",
  ]);
  expect((await db.query("SELECT * FROM group_events")).rows).toHaveLength(1);
  await apply(o);
  expect(await rsvps(e)).toHaveLength(0);
  expect(
    (await db.query("SELECT * FROM payment_cancellation_requests")).rows
  ).toMatchObject([{ status: "requested", order_id: o.id }]);
});
it("pending or failed refunds keep a place; confirmed refunds release it and never regrant on refund failure", async () => {
  const e = await event();
  const o = await book(e);
  await apply(o);
  await db.query("SELECT payment_request_cancellation($1,$2,$3)", [
    o.id,
    buyer,
    "Cannot make it",
  ]);
  await db.query("SELECT payment_cancel_reservation($1,$2,$3,$4)", [
    o.id,
    owner,
    "Full refund approved",
    "refund_pending",
  ]);
  async function snap(status: string) {
    const v = (
      await db.query<any>(
        "SELECT payment_begin_refund_sync('acct_venue',true,'pi_valid') v"
      )
    ).rows[0].v;
    await db.query(
      "SELECT payment_apply_refund_snapshot('acct_venue',true,'pi_valid',$1,2000,$2,false)",
      [v, JSON.stringify([{ id: "re_event", amount: 2000, status }])]
    );
  }
  await snap("pending");
  expect(await rsvps(e)).toMatchObject([{ status: "going" }]);
  await snap("failed");
  expect(await rsvps(e)).toMatchObject([{ status: "going" }]);
  await snap("succeeded");
  expect(await rsvps(e)).toMatchObject([{ status: "not_going" }]);
  await snap("failed");
  await apply(o);
  expect(await rsvps(e)).toMatchObject([{ status: "not_going" }]);
});
it("enforces optimistic edits, price locks, check-in access and abbreviated management rosters", async () => {
  const e = await event();
  const o = await book(e);
  await apply(o);
  const before = (
    await db.query<any>("SELECT * FROM group_events WHERE id=$1", [e])
  ).rows[0];
  await expect(
    asUser(owner, "SELECT update_venue_program($1,$2,$3,$4)", [
      e,
      JSON.stringify({ price_cents: 3000 }),
      [court],
      before.updated_at,
    ])
  ).rejects.toThrow("Price is locked");
  const r = (await rsvps(e))[0];
  await expect(
    asUser(buyer, "SELECT set_venue_event_checkin($1,$2,true)", [e, r.id])
  ).rejects.toThrow("access required");
  await asUser(owner, "SELECT set_venue_event_checkin($1,$2,true)", [e, r.id]);
  expect((await rsvps(e))[0].checked_in_at).toBeTruthy();
  const people = (
    await asUser(owner, "SELECT get_venue_event_attendees($1) people", [e])
  ).rows[0] as any;
  expect(people.people[0].name).toBe("Alex S.");
  expect(JSON.stringify(people)).not.toContain("Surname");
  await expect(
    asUser(buyer, "SELECT get_venue_event_attendees($1)", [e])
  ).rejects.toThrow("access required");
});
it("preserves rental fulfillment and refund behavior alongside paid events", async () => {
  const o = await reserve();
  await apply(o);
  expect(
    (
      await db.query("SELECT * FROM group_events WHERE payment_order_id=$1", [
        o.id,
      ])
    ).rows
  ).toHaveLength(1);
  await db.query("SELECT payment_request_cancellation($1,$2,$3)", [
    o.id,
    buyer,
    "Cannot make it",
  ]);
  await db.query("SELECT payment_cancel_reservation($1,$2,$3,$4)", [
    o.id,
    owner,
    "Full refund approved",
    "refund_pending",
  ]);
  const v = (
    await db.query<any>(
      "SELECT payment_begin_refund_sync('acct_venue',true,'pi_valid') v"
    )
  ).rows[0].v;
  await db.query(
    "SELECT payment_apply_refund_snapshot('acct_venue',true,'pi_valid',$1,3000,$2,false)",
    [
      v,
      JSON.stringify([{ id: "re_rental", amount: 3000, status: "succeeded" }]),
    ]
  );
  expect(
    (
      await db.query("SELECT * FROM group_events WHERE payment_order_id=$1", [
        o.id,
      ])
    ).rows
  ).toHaveLength(0);
});
it("allows manager scheduling without financial ownership and blocks transferred-account refunds", async () => {
  await db.query(
    "INSERT INTO venue_staff VALUES($1,$2,true,'active','organizer')",
    [venue, other]
  );
  const d = await draft();
  await asUser(other, "SELECT publish_venue_event_draft($1,$2)", [
    d.id,
    d.updated_at,
  ]);
  const e = (await publish(d))[0];
  const o = await book(e);
  await apply(o);
  await expect(
    db.query("SELECT payment_save_event_settings($1,$2,true)", [other, venue])
  ).rejects.toThrow("Only the venue owner");
  await db.query("SELECT payment_request_cancellation($1,$2,$3)", [
    o.id,
    buyer,
    "Cannot make it",
  ]);
  await db.query("UPDATE venues SET owner_id=$1 WHERE id=$2", [other, venue]);
  await expect(
    db.query("SELECT payment_cancel_reservation($1,$2,$3,$4)", [
      o.id,
      other,
      "Refund requested",
      "refund_pending",
    ])
  ).rejects.toThrow("Financial ownership");
});
it("rejects forged payment links, moved RSVP identities and unsafe capacity changes; cancellation notifies registered players", async () => {
  const e = await event();
  const o = await book(e);
  await apply(o);
  const r = (await rsvps(e))[0];
  await expect(
    asUser(buyer, "UPDATE group_event_rsvps SET event_id=$1 WHERE id=$2", [
      id(123),
      r.id,
    ])
  ).rejects.toThrow("cannot be moved");
  await expect(
    db.query(
      "INSERT INTO group_event_rsvps(event_id,user_id,status,payment_order_id) VALUES($1,$2,'going',$3)",
      [e, other, o.id]
    )
  ).rejects.toThrow("Invalid registration payment");
  await book(e, other, true, id(92));
  const current = (
    await db.query<any>("SELECT * FROM group_events WHERE id=$1", [e])
  ).rows[0];
  await expect(
    asUser(owner, "SELECT update_venue_program($1,$2,$3,$4)", [
      e,
      JSON.stringify({ capacity: 1 }),
      [court],
      current.updated_at,
    ])
  ).rejects.toThrow("Capacity cannot");
  await asUser(owner, "SELECT cancel_venue_program($1,$2,$3)", [
    e,
    current.updated_at,
    "Weather cancellation",
  ]);
  expect(
    (
      await db.query(
        "SELECT * FROM change_notifications WHERE title='Event canceled'"
      )
    ).rows.length
  ).toBeGreaterThan(0);
});
it("edits court allocations atomically and rejects stale management saves", async () => {
  const e = await event(0);
  const d = await draft({ ...doc(), court_ids: [secondCourt], price_cents: 0 });
  await publish(d);
  const current = (
    await db.query<any>("SELECT * FROM group_events WHERE id=$1", [e])
  ).rows[0];
  await expect(
    asUser(owner, "SELECT update_venue_program($1,$2,$3,$4)", [
      e,
      JSON.stringify({ title: "Conflicting edit" }),
      [secondCourt],
      current.updated_at,
    ])
  ).rejects.toMatchObject({ code: "23P01" });
  expect(
    (await db.query<any>("SELECT title FROM group_events WHERE id=$1", [e]))
      .rows[0].title
  ).toBe("Evening clinic");
  await asUser(owner, "SELECT update_venue_program($1,$2,$3,$4)", [
    e,
    JSON.stringify({ title: "Updated clinic", registration_paused: true }),
    [court],
    current.updated_at,
  ]);
  await expect(
    asUser(owner, "SELECT update_venue_program($1,$2,$3,$4)", [
      e,
      JSON.stringify({ title: "Stale edit" }),
      [court],
      current.updated_at,
    ])
  ).rejects.toThrow("event changed");
  await expect(
    db.query(
      "INSERT INTO group_event_rsvps(event_id,user_id,status) VALUES($1,$2,'going')",
      [e, buyer]
    )
  ).rejects.toThrow("Registration is closed");
});
it("returns a scoped management workspace and keeps payment activation restricted", async () => {
  await event();
  await draft();
  const workspace = (
    await asUser(
      owner,
      "SELECT get_venue_event_management($1,now(),now()+interval '180 days') w",
      [group]
    )
  ).rows[0] as any;
  expect(workspace.w).toMatchObject({
    is_owner: true,
    accepting_event_payments: true,
    facility_enabled: true,
  });
  expect(workspace.w.events).toHaveLength(1);
  expect(workspace.w.drafts).toHaveLength(1);
  await expect(
    asUser(
      buyer,
      "SELECT get_venue_event_management($1,now(),now()+interval '180 days')",
      [group]
    )
  ).rejects.toThrow("access required");
  await db.query("SELECT payment_save_event_settings($1,$2,false)", [
    owner,
    venue,
  ]);
  const e = workspace.w.events[0].id;
  await expect(book(e)).rejects.toThrow("not accepting event payments");
  await db.exec("UPDATE venue_payment_accounts SET card_payments_active=false");
  await expect(
    db.query("SELECT payment_save_event_settings($1,$2,true)", [owner, venue])
  ).rejects.toThrow("Complete Stripe verification");
});
it("applies the required restrictive MFA policy to event drafts", async () => {
  await draft();
  expect(
    (await asUser(owner, "SELECT id FROM venue_event_drafts")).rows
  ).toHaveLength(1);
  await db.exec("SELECT set_config('test.mfa_required','unverified',false)");
  try {
    expect(
      (await asUser(owner, "SELECT id FROM venue_event_drafts")).rows
    ).toHaveLength(0);
  } finally {
    await db.exec("SELECT set_config('test.mfa_required','',false)");
  }
  expect(
    (
      await db.query<any>(
        "SELECT polpermissive FROM pg_policy WHERE polname='pulse_required_mfa' AND polrelid='venue_event_drafts'::regclass"
      )
    ).rows[0].polpermissive
  ).toBe(false);
});
