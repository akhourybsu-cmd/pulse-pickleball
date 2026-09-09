import { readFileSync } from "node:fs";
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
    await db.exec("RESET ROLE");
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
  db = new PGlite();
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
  await db.query("INSERT INTO groups VALUES($1,$2)", [group, venue]);
  await db.query(
    "INSERT INTO group_members VALUES($1,$2,'active'),($1,$3,'active')",
    [group, buyer, other]
  );
  await db.query(
    "INSERT INTO venue_courts VALUES($1,$2,'Court 1',true,20),($3,$2,'Court 2',true,30)",
    [court, venue, secondCourt]
  );
  await db.query(
    "INSERT INTO venue_module_access VALUES($1,'court_booking','existing_venue',true,NULL,now())",
    [venue]
  );
  await db.query(
    "INSERT INTO venue_payment_settings VALUES($1,true,$2,'venue@example.com','UTC',true,now())",
    [venue, policy]
  );
  await db.query(
    "INSERT INTO venue_payment_accounts VALUES($1,true,'acct_venue',$2,true,true,true,NULL,now()),($1,false,'acct_venue',$2,true,true,true,NULL,now())",
    [venue, owner]
  );
});
afterAll(async () => {
  await db?.close();
});

describe("ELEVENO free-tier reset", () => {
  const target = "4ee96566-4074-41c0-aa2b-2d767bdb50e1";
  const targetGroup = "e3e97754-ac66-4814-94f3-ae3391de4e33";
  const migration = readFileSync(
    "supabase/migrations/20260919100000_eleveno_free_tier_and_upgrade_reactivation.sql",
    "utf8"
  );
  async function seed() {
    await db.query(
      "INSERT INTO venues(id,name,owner_id,is_active,community_model) VALUES($1,'ELEVENO',$2,true,'existing')",
      [target, owner]
    );
    await db.query("INSERT INTO groups VALUES($1,$2)", [targetGroup, target]);
    await db.query(
      "INSERT INTO venue_module_access VALUES($1,'court_booking','existing_venue',true,NULL,now()),($1,'facility_tools','existing_venue',true,NULL,now())",
      [target]
    );
    await db.query(
      "INSERT INTO venue_courts VALUES($1,$2,'Keep this court',true,0)",
      [id(80), target]
    );
    await db.query("INSERT INTO group_members VALUES($1,$2,'active')", [
      targetGroup,
      buyer,
    ]);
    await db.query(
      "INSERT INTO group_events(group_id,venue_id,venue_court_id,created_by,title,start_time,end_time,event_format) VALUES($1,$2,$3,$4,'Keep this event',$5,$6,'reservation')",
      [targetGroup, target, id(80), buyer, tomorrow, later]
    );
  }
  it("disables only ELEVENO grants while preserving its owner, courts, events and members", async () => {
    await seed();
    const before = (await db.query("SELECT * FROM group_events")).rows;
    await db.exec(migration);
    expect(
      (await db.query<any>("SELECT * FROM venues WHERE id=$1", [target]))
        .rows[0]
    ).toMatchObject({
      owner_id: owner,
      community_model: "free_verified",
      verification_approved_at: null,
    });
    expect(
      (
        await db.query<any>(
          "SELECT enabled,source FROM venue_module_access WHERE venue_id=$1",
          [target]
        )
      ).rows
    ).toEqual([
      { enabled: false, source: "existing_venue" },
      { enabled: false, source: "existing_venue" },
    ]);
    expect((await db.query("SELECT * FROM group_events")).rows).toEqual(before);
    expect(
      (await db.query("SELECT * FROM venue_courts WHERE venue_id=$1", [target]))
        .rows
    ).toHaveLength(1);
    expect(
      (
        await db.query("SELECT * FROM group_members WHERE group_id=$1", [
          targetGroup,
        ])
      ).rows
    ).toHaveLength(1);
    expect(
      (
        await db.query<any>(
          "SELECT enabled FROM venue_module_access WHERE venue_id=$1",
          [venue]
        )
      ).rows[0].enabled
    ).toBe(true);
    await db.exec(migration);
    expect((await db.query("SELECT * FROM group_events")).rows).toEqual(before);
  });
  it("aborts a reset if a live order exists", async () => {
    await seed();
    await db.query(
      "INSERT INTO payment_orders(buyer_id,venue_id,kind,module_key,billing_cadence,description,merchant_name,account_id,livemode,amount_cents,request_key) VALUES($1,$2,'venue_module','court_booking','monthly','Test feature','PULSE','acct_pulse',true,1000,$3)",
      [owner, target, id(81)]
    );
    await expect(db.exec(migration)).rejects.toThrow(
      "Review ELEVENO paid orders/subscriptions"
    );
    await db.exec("ROLLBACK");
    expect(
      (
        await db.query<any>(
          "SELECT enabled FROM venue_module_access WHERE venue_id=$1",
          [target]
        )
      ).rows.every((row) => row.enabled)
    ).toBe(true);
  });
  it("refuses a renamed or relinked target instead of resetting the wrong venue", async () => {
    await seed();
    await db.query("UPDATE venues SET name='Different business' WHERE id=$1", [
      target,
    ]);
    await expect(db.exec(migration)).rejects.toThrow("reset target mismatch");
    await db.exec("ROLLBACK");
    expect(
      (
        await db.query<any>(
          "SELECT enabled FROM venue_module_access WHERE venue_id=$1",
          [target]
        )
      ).rows.every((row) => row.enabled)
    ).toBe(true);
  });
});

describe("payment boundary helpers", () => {
  it("keeps charging off unless separately configured", () => {
    expect(billingMode(() => undefined)).toEqual({
      mode: "off",
      livemode: false,
      cadence: "monthly",
    });
    expect(() => assertPaymentConfiguration(() => undefined)).toThrow(
      "not enabled"
    );
    const values: any = {
      PULSE_PAYMENTS_MODE: "test",
      PULSE_STRIPE_SECRET_KEY: "sk_live_no",
      PULSE_STRIPE_ACCOUNT_ID: "acct_123",
    };
    expect(() => assertPaymentConfiguration((key) => values[key])).toThrow(
      "does not match"
    );
    values.PULSE_PAYMENTS_MODE = "live";
    expect(() => assertPaymentConfiguration((key) => values[key])).toThrow(
      "not been approved"
    );
  });
  it("fixes venue features at $10 monthly without enabling payments", () => {
    expect(MODULE_AMOUNT_CENTS).toBe(1000);
    expect(MODULE_BILLING_TERMS).toContain("per feature per month");
    expect(MODULE_BILLING_TERMS).toContain(
      "Renews automatically until canceled"
    );
    for (const mode of ["off", "test", "live"]) {
      const values: Record<string, string> = { PULSE_PAYMENTS_MODE: mode };
      expect(billingMode((key) => values[key])).toEqual({
        mode,
        livemode: mode === "live",
        cadence: "monthly",
      });
      values.PULSE_MODULE_BILLING = "monthly";
      expect(billingMode((key) => values[key]).cadence).toBe("monthly");
      for (const invalid of ["one_time", "annual", "", "MONTHLY"]) {
        values.PULSE_MODULE_BILLING = invalid;
        expect(() => billingMode((key) => values[key])).toThrow(
          "monthly billing"
        );
      }
    }
  });
  it("validates money without silently rounding extra decimals or interpreting exponents", () => {
    expect(moneyInput("10.00")).toBe(1000);
    expect(moneyInput("0")).toBe(0);
    for (const value of [
      "10.009",
      "-1",
      "1e3",
      "NaN",
      "Infinity",
      " 10",
      "1,000",
      1000,
    ])
      expect(() => moneyInput(value)).toThrow();
    expect(() => moduleName("__proto__")).toThrow();
    expect(() => uuid("not-an-id")).toThrow();
    expect(uuid(buyer)).toBe(buyer);
  });
  it("rejects mismatched amount, buyer customer, order, mode, and recurrence", () => {
    const order = {
      id: "order",
      livemode: false,
      amount_cents: 1000,
      currency: "usd",
      customer_id: "cus_1",
      billing_cadence: "one_time",
      checkout_session_id: "cs_1",
    };
    const session = {
      id: "cs_1",
      client_reference_id: "order",
      metadata: { pulse_order_id: "order" },
      livemode: false,
      amount_total: 1000,
      currency: "usd",
      customer: "cus_1",
      mode: "payment",
    };
    expect(() => assertCheckoutMatches(order, session)).not.toThrow();
    const monthlyOrder = { ...order, billing_cadence: "monthly" };
    expect(() => assertCheckoutMatches(monthlyOrder, session)).toThrow(
      "mismatch"
    );
    expect(() =>
      assertCheckoutMatches(monthlyOrder, { ...session, mode: "subscription" })
    ).not.toThrow();
    for (const patch of [
      { amount_total: 1 },
      { customer: "cus_2" },
      { livemode: true },
      { mode: "subscription" },
      { id: "cs_2" },
      { client_reference_id: "other" },
    ])
      expect(() =>
        assertCheckoutMatches(order, { ...session, ...patch })
      ).toThrow("mismatch");
  });
});

describe("court checkout and isolation", () => {
  it("quotes the server hourly rate and snapshots terms", async () => {
    const order = await reserve();
    expect(order.amount_cents).toBe(3000);
    expect(order.account_id).toBe("acct_venue");
    expect(order.policy_snapshot).toBe(policy);
    await expect(reserve(other, true, id(11), 1)).rejects.toThrow();
  });
  it("rejects a price or policy changed after the player reviewed it", async () => {
    await expect(reserve(buyer, true, id(10), 2999)).rejects.toThrow("changed");
    await expect(
      reserve(buyer, true, id(10), 3000, "Different policy")
    ).rejects.toThrow("changed");
    expect((await db.query("SELECT * FROM payment_orders")).rows).toHaveLength(
      0
    );
  });
  it("blocks overlapping buyers while retaining retry idempotency", async () => {
    const order = await reserve();
    expect((await reserve()).id).toBe(order.id);
    await expect(reserve(other, true, id(11))).rejects.toThrow(
      "no longer available"
    );
    await db.query(
      "UPDATE payment_orders SET expires_at=now()-interval '1 hour' WHERE id=$1",
      [order.id]
    );
    await expect(reserve(other, true, id(12))).rejects.toThrow(
      "no longer available"
    );
  });
  it("does not reveal another player’s financial records, but shows only their held slot", async () => {
    const order = await reserve();
    expect(
      (await asUser(other, "SELECT * FROM payment_orders")).rows
    ).toHaveLength(0);
    expect((await asUser(buyer, "SELECT id FROM payment_orders")).rows).toEqual(
      [{ id: order.id }]
    );
    expect(
      (
        await asUser(other, "SELECT * FROM venue_checkout_holds($1,$2,$3)", [
          venue,
          tomorrow,
          later,
        ])
      ).rows[0]
    ).toMatchObject({ title: "Checkout in progress", venue_court_id: court });
    expect(
      (await asUser(owner, "SELECT * FROM payment_orders")).rows
    ).toHaveLength(1);
  });
  it("blocks direct paid inserts and a different player writing over an invisible payment hold", async () => {
    await expect(
      asUser(
        buyer,
        "INSERT INTO group_events(group_id,venue_id,venue_court_id,created_by,title,start_time,end_time,event_format) VALUES($1,$2,$3,$4,'Skip payment',$5,$6,'reservation')",
        [group, venue, court, buyer, tomorrow, later]
      )
    ).rejects.toThrow("secure checkout");
    await reserve();
    await expect(
      asUser(
        other,
        "INSERT INTO group_events(group_id,venue_id,venue_court_id,created_by,title,start_time,end_time,event_format) VALUES($1,$2,$3,$4,'Override',$5,$6,'maintenance')",
        [group, venue, court, other, tomorrow, later]
      )
    ).rejects.toThrow("held during checkout");
  });
  it("requires verified ownership and the currently connected owner", async () => {
    await db.query("UPDATE venues SET owner_id=$1", [other]);
    await expect(reserve()).rejects.toThrow("verification");
  });
  it("rejects nonmembers, inactive courts, closed days and far-future dates", async () => {
    await expect(reserve(owner)).rejects.toThrow("Join");
    await db.exec("UPDATE venue_courts SET is_active=false");
    await expect(reserve()).rejects.toThrow("unavailable");
    await db.exec("UPDATE venue_courts SET is_active=true");
    await expect(
      db.query("SELECT payment_court_quote($1,$2,$3,$4,$5,true)", [
        buyer,
        group,
        court,
        start,
        end,
      ])
    ).rejects.toThrow("180 days");
    const dow = new Date(tomorrow).getUTCDay();
    await db.query("UPDATE venues SET hours_of_operation=$1", [
      { days: { [dow]: null } },
    ]);
    await expect(reserve()).rejects.toThrow("closed");
  });
  it("rejects all browser ledger writes and fulfillment RPCs", async () => {
    const order = await reserve();
    await expect(
      asUser(buyer, "UPDATE payment_orders SET status='paid' WHERE id=$1", [
        order.id,
      ])
    ).rejects.toThrow("permission denied");
    await expect(
      asUser(
        owner,
        "UPDATE venue_payment_accounts SET account_id='acct_attacker'"
      )
    ).rejects.toThrow("permission denied");
    await expect(
      asUser(
        buyer,
        "SELECT payment_apply_result($1,'acct_venue',true,'cs_1','paid',3000,'usd','pi_1','cus_1',NULL,NULL)",
        [order.id]
      )
    ).rejects.toThrow("permission denied");
  });
  it("keeps rate/settings edits atomic if one court belongs elsewhere", async () => {
    await expect(
      db.query("SELECT payment_save_venue($1,$2,false,$3,$4,$5,$6)", [
        owner,
        venue,
        policy,
        "venue@example.com",
        "UTC",
        [
          { id: court, cents: 1000 },
          { id: id(99), cents: 1000 },
        ],
      ])
    ).rejects.toThrow("belong");
    expect(
      (
        await db.query<any>(
          "SELECT hourly_rate FROM venue_courts WHERE id=$1",
          [court]
        )
      ).rows[0].hourly_rate
    ).toBe("20");
  });
});

describe("verified fulfillment, refunds and subscriptions", () => {
  it("honors a paid checkout even if the booking add-on expires during payment", async () => {
    const order = await reserve();
    await db.exec(
      "UPDATE venue_module_access SET expires_at=now()-interval '1 minute'"
    );
    await apply(order);
    expect((await db.query("SELECT * FROM group_events")).rows).toHaveLength(1);
  });
  it("atomically grants a legacy league slot once, rolling back if its profile is missing", async () => {
    await expect(
      db.query(
        "SELECT payment_fulfill_league_slot($1,'cs_legacy','cus_legacy',1000,'usd')",
        [buyer]
      )
    ).rejects.toThrow("Missing profile");
    expect(
      (await db.query("SELECT * FROM league_slot_purchases")).rows
    ).toHaveLength(0);
    await db.query("INSERT INTO profiles(id) VALUES($1)", [buyer]);
    for (let i = 0; i < 2; i++)
      await db.query(
        "SELECT payment_fulfill_league_slot($1,'cs_legacy','cus_legacy',1000,'usd')",
        [buyer]
      );
    expect(
      (await db.query<any>("SELECT additional_league_slots FROM profiles"))
        .rows[0].additional_league_slots
    ).toBe(1);
    await expect(
      db.query(
        "SELECT payment_fulfill_league_slot($1,'cs_legacy','cus_legacy',1000,'usd')",
        [other]
      )
    ).rejects.toThrow("another");
  });
  it("fulfills exactly once and never accepts altered payment facts", async () => {
    const order = await reserve();
    for (const patch of [
      { account: "acct_other" },
      { live: false },
      { amount: 100 },
      { currency: "eur" },
      { intent: null },
    ])
      await expect(apply(order, "paid", patch)).rejects.toThrow();
    await apply(order);
    await apply(order);
    expect((await db.query("SELECT * FROM group_events")).rows).toHaveLength(1);
    await expect(asUser(buyer, "DELETE FROM group_events")).rejects.toThrow(
      "Payments & purchases"
    );
    await expect(
      asUser(
        buyer,
        "UPDATE group_events SET start_time=start_time+interval '1 hour'"
      )
    ).rejects.toThrow("rescheduled");
  });
  it("test payments never create real bookings", async () => {
    const order = await reserve(buyer, false);
    await apply(order);
    expect((await db.query("SELECT * FROM group_events")).rows).toHaveLength(0);
    expect(
      (await db.query<any>("SELECT status FROM payment_orders")).rows[0].status
    ).toBe("paid");
  });
  it("only processor-confirmed expiry releases a hold", async () => {
    const order = await reserve();
    await expect(apply(order, "pending")).rejects.toThrow("terminal");
    await apply(order, "expired", { intent: null });
    expect((await reserve(other, true, id(11))).status).toBe("pending");
  });
  it("a partial refund does not cancel a reservation; a successful requested full refund does", async () => {
    const order = await reserve();
    await apply(order);
    await db.query("SELECT payment_request_cancellation($1,$2,$3)", [
      order.id,
      buyer,
      "Unable to attend.",
    ]);
    await db.query("SELECT payment_cancel_reservation($1,$2,$3,$4)", [
      order.id,
      owner,
      "Refund approved under policy.",
      "refund_pending",
    ]);
    await db.query(
      "SELECT payment_record_charge('acct_venue',true,'pi_valid',1000,false)"
    );
    expect((await db.query("SELECT * FROM group_events")).rows).toHaveLength(1);
    await db.query(
      "SELECT payment_record_charge('acct_venue',true,'pi_valid',3000,false)"
    );
    expect((await db.query("SELECT * FROM group_events")).rows).toHaveLength(0);
    await db.query(
      "SELECT payment_record_charge('acct_venue',true,'pi_valid',1000,false)"
    );
    expect(
      (await db.query<any>("SELECT refunded_cents,status FROM payment_orders"))
        .rows[0]
    ).toMatchObject({ refunded_cents: 3000, status: "refunded" });
  });
  it("nonowners cannot resolve cancellations", async () => {
    const order = await reserve();
    await apply(order);
    await db.query("SELECT payment_request_cancellation($1,$2,$3)", [
      order.id,
      buyer,
      "Unable to attend.",
    ]);
    await expect(
      db.query("SELECT payment_cancel_reservation($1,$2,$3,$4)", [
        order.id,
        other,
        "Cancel it please.",
        "cancel_without_refund",
      ])
    ).rejects.toThrow("owner");
  });
  it("canceling without refund records the decision without inventing refunded money", async () => {
    const order = await reserve();
    await apply(order);
    await db.query("SELECT payment_request_cancellation($1,$2,$3)", [
      order.id,
      buyer,
      "Unable to attend.",
    ]);
    await db.query("SELECT payment_cancel_reservation($1,$2,$3,$4)", [
      order.id,
      owner,
      "Outside cancellation window.",
      "cancel_without_refund",
    ]);
    const saved = (await db.query<any>("SELECT * FROM payment_orders")).rows[0];
    expect(saved.canceled_at).not.toBeNull();
    expect(saved.refunded_cents).toBe(0);
  });
  it("requires $10 monthly module orders and keeps rental orders one-time", async () => {
    for (const [cadence, amount] of [
      ["one_time", 1000],
      ["monthly", 999],
      ["monthly", 2000],
    ]) {
      await expect(
        db.query(
          "INSERT INTO payment_orders(buyer_id,venue_id,kind,module_key,billing_cadence,description,merchant_name,account_id,livemode,amount_cents,request_key) VALUES($1,$2,'venue_module','facility_tools',$3,'Facility tools','PULSE Pickleball','acct_pulse',false,$4,$5)",
          [owner, venue, cadence, amount, id(20)]
        )
      ).rejects.toThrow("check constraint");
    }
    const rental = await reserve();
    expect(rental.billing_cadence).toBe("one_time");
    await expect(
      db.query(
        "UPDATE payment_orders SET billing_cadence='monthly' WHERE id=$1",
        [rental.id]
      )
    ).rejects.toThrow("check constraint");
  });
  it("module test payments grant nothing, while paid live renewals extend access exactly once", async () => {
    async function module(live: boolean) {
      return (
        await db.query<any>(
          "INSERT INTO payment_orders(buyer_id,venue_id,kind,module_key,billing_cadence,description,merchant_name,account_id,livemode,amount_cents,request_key) VALUES($1,$2,'venue_module','facility_tools','monthly','Facility tools','PULSE Pickleball','acct_pulse',$3,1000,$4) RETURNING *",
          [owner, venue, live, id(live ? 21 : 20)]
        )
      ).rows[0];
    }
    const through = new Date(Date.now() + 30 * 86400000).toISOString();
    await apply(await module(false), "paid", {
      account: "acct_pulse",
      subscription: "sub_test",
      through,
    });
    expect(
      (
        await db.query(
          "SELECT * FROM venue_module_access WHERE module_key='facility_tools'"
        )
      ).rows
    ).toHaveLength(0);
    const liveOrder = await module(true);
    for (const missing of [
      { subscription: null, through },
      { subscription: "sub_live", through: null },
    ]) {
      await expect(
        apply(liveOrder, "paid", {
          account: "acct_pulse",
          session: "cs_live",
          ...missing,
        })
      ).rejects.toThrow("Subscription paid period is required");
    }
    expect(
      (
        await db.query<any>("SELECT status FROM payment_orders WHERE id=$1", [
          liveOrder.id,
        ])
      ).rows[0].status
    ).toBe("pending");
    await apply(liveOrder, "paid", {
      account: "acct_pulse",
      subscription: "sub_live",
      session: "cs_live",
      through,
    });
    await expect(
      db.query(
        "SELECT payment_record_renewal('sub_live','in_wrong_price',999,'usd','pi_renewal','cus_buyer',$1)",
        [new Date(Date.now() + 60 * 86400000).toISOString()]
      )
    ).rejects.toThrow("Renewal payment mismatch");
    for (let i = 0; i < 2; i++)
      await db.query(
        "SELECT payment_record_renewal('sub_live','in_renewal',1000,'usd','pi_renewal','cus_buyer',$1)",
        [new Date(Date.now() + 60 * 86400000).toISOString()]
      );
    expect(
      (
        await db.query(
          "SELECT * FROM payment_orders WHERE invoice_id='in_renewal'"
        )
      ).rows
    ).toHaveLength(1);
    expect(
      (
        await db.query<any>(
          "SELECT enabled FROM venue_module_access WHERE module_key='facility_tools'"
        )
      ).rows[0].enabled
    ).toBe(true);
  });
  it.each([
    ["existing_venue", false, null, "subscription"],
    ["staff_grant", false, null, "subscription"],
    ["existing_venue", true, "2020-01-01T00:00:00Z", "subscription"],
    ["existing_venue", true, null, "existing_venue"],
    ["staff_grant", true, null, "staff_grant"],
  ])(
    "paid upgrade respects %s enabled=%s expires=%s",
    async (source, enabled, expires, expectedSource) => {
      await db.query(
        "INSERT INTO venue_module_access VALUES($1,'facility_tools',$2,$3,$4,now())",
        [venue, source, enabled, expires]
      );
      const order = (
        await db.query<any>(
          "INSERT INTO payment_orders(buyer_id,venue_id,kind,module_key,billing_cadence,description,merchant_name,account_id,livemode,amount_cents,request_key) VALUES($1,$2,'venue_module','facility_tools','monthly','Facility tools','PULSE','acct_pulse',true,1000,$3) RETURNING *",
          [owner, venue, id(25)]
        )
      ).rows[0];
      const through = new Date(Date.now() + 30 * 86400000).toISOString();
      await apply(order, "paid", {
        account: "acct_pulse",
        subscription: "sub_reactivation",
        through,
      });
      const grant = (
        await db.query<any>(
          "SELECT * FROM venue_module_access WHERE venue_id=$1 AND module_key='facility_tools'",
          [venue]
        )
      ).rows[0];
      expect(grant).toMatchObject({ enabled: true, source: expectedSource });
      if (expectedSource === "subscription")
        expect(new Date(grant.expires_at).toISOString()).toBe(through);
      else expect(grant.expires_at).toBeNull();
    }
  );
});
