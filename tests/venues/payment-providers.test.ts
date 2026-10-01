import { beforeAll, afterAll, it, expect } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { venueSuiteDatabase } from "../helpers/venueSuiteDatabase";
const id = (n: number) =>
  `72000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const owner = id(1),
  player = id(2),
  stranger = id(3),
  venue = id(4),
  customer = id(5),
  product = id(6);
let db: PGlite, connection: string, order: any;
async function as(user: string, sql: string, args: unknown[] = []) {
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [user]);
  await db.exec("SET ROLE authenticated");
  try {
    return (await db.query<any>(sql, args)).rows;
  } finally {
    await db.exec(
      "RESET ROLE;SELECT set_config('request.jwt.claim.sub','',false)",
    );
  }
}
beforeAll(async () => {
  db = await venueSuiteDatabase();
  // Vault storage is emulated only in this isolated database; browser grants still tested.
  await db.exec(`CREATE SCHEMA vault; CREATE TABLE vault.secrets(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),secret text);
 CREATE VIEW vault.decrypted_secrets AS SELECT id,secret AS decrypted_secret FROM vault.secrets;
 CREATE FUNCTION vault.create_secret(text,text) RETURNS uuid LANGUAGE plpgsql AS $$ DECLARE result uuid; BEGIN INSERT INTO vault.secrets(secret) VALUES($1) RETURNING id INTO result; RETURN result; END $$;
 CREATE FUNCTION vault.update_secret(uuid,text) RETURNS void LANGUAGE sql AS $$ UPDATE vault.secrets SET secret=$2 WHERE id=$1 $$;`);
  await db.query("INSERT INTO auth.users VALUES($1),($2),($3)", [
    owner,
    player,
    stranger,
  ]);
  await db.query(
    "INSERT INTO venues(id,name,owner_id,verification_approved_at,is_active) VALUES($1,'Venue',$2,now(),true)",
    [venue, owner],
  );
  await db.query(
    "INSERT INTO venue_module_access VALUES($1,'facility_tools','existing_venue',true,NULL,now())",
    [venue],
  );
  await db.query(
    "INSERT INTO venue_customers(id,venue_id,user_id,first_name,last_name) VALUES($1,$2,$3,'Player','One')",
    [customer, venue, player],
  );
  await db.query(
    "INSERT INTO venue_payment_settings(venue_id,cancellation_policy,support_email,timezone,tax_inclusive_acknowledged) VALUES($1,'Cancel before arrival for a full refund.','venue@example.test','UTC',true)",
    [venue],
  );
  await db.query(
    "INSERT INTO venue_products(id,venue_id,name,kind,price_cents,stock) VALUES($1,$2,'Paddle rental','equipment_rental',2500,5)",
    [product, venue],
  );
}, 30000);
afterAll(() => db?.close());
it("requires current owner access and hides all credential tables and RPCs from players", async () => {
  await expect(
    as(stranger, "SELECT venue_processor_workspace($1)", [venue]),
  ).rejects.toMatchObject({ code: "42501" });
  await expect(
    as(owner, "SELECT * FROM venue_processor_connections"),
  ).rejects.toMatchObject({ code: "42501" });
  await expect(
    as(owner, "SELECT venue_processor_credentials($1)", [id(100)]),
  ).rejects.toMatchObject({ code: "42501" });
  const rows = (
    await db.query<any>(`SELECT c.relname,c.relrowsecurity AS rls,
 EXISTS(SELECT 1 FROM pg_policy p WHERE p.polrelid=c.oid AND p.polname='pulse_required_mfa' AND NOT p.polpermissive) AS mfa
 FROM pg_class c WHERE c.relname IN ('venue_processor_connections','venue_processor_oauth_states','venue_processor_preferences','venue_processor_requests')`)
  ).rows;
  expect(rows).toHaveLength(4);
  expect(rows.every((r) => r.rls && r.mfa)).toBe(true);
});
it("consumes an OAuth state only for its bound actor, venue and mode, once", async () => {
  await db.query(
    "INSERT INTO venue_processor_oauth_states(state_hash,venue_id,actor_id,provider,livemode) VALUES('hash',$1,$2,'square',true)",
    [venue, owner],
  );
  await expect(
    db.query("SELECT venue_processor_consume_state('hash',$1,$2,false)", [
      owner,
      venue,
    ]),
  ).rejects.toThrow("Connection expired");
  await db.query("SELECT venue_processor_consume_state('hash',$1,$2,true)", [
    owner,
    venue,
  ]);
  await expect(
    db.query("SELECT venue_processor_consume_state('hash',$1,$2,true)", [
      owner,
      venue,
    ]),
  ).rejects.toThrow("Connection expired");
});
it("connects without exposing tokens, requires a location, and rejects replacing the merchant", async () => {
  connection = (
    await db.query<any>(
      "SELECT venue_processor_store_square($1,$2,true,'merchant','Existing Square business',$3,now()+interval '30 days') id",
      [
        venue,
        owner,
        JSON.stringify({
          access_token: "private-access",
          refresh_token: "private-refresh",
        }),
      ],
    )
  ).rows[0].id;
  const workspace = (
    await as(owner, "SELECT venue_processor_workspace($1) data", [venue])
  )[0].data;
  expect(JSON.stringify(workspace)).not.toMatch(
    /private-access|secret_id|merchant_id|refresh_token/,
  );
  await expect(
    db.query("SELECT venue_processor_set_desk($1,$2,'square')", [venue, owner]),
  ).rejects.toThrow("verify a live Square location");
  await expect(
    db.query(
      "SELECT venue_processor_store_square($1,$2,true,'other','Different business',$3,now()+interval '30 days')",
      [venue, owner, JSON.stringify({ access_token: "private-access" })],
    ),
  ).rejects.toThrow("different payment owner or merchant");
  await db.query(
    "SELECT venue_processor_select_location($1,$2,'location','Main location')",
    [connection, owner],
  );
  await db.query("SELECT venue_processor_set_desk($1,$2,'square')", [
    venue,
    owner,
  ]);
});
it("reserves a Square desk sale without requiring a Stripe account and keeps retry destination immutable", async () => {
  const args = [owner, customer, product, 1, 2500, id(10)];
  order = (
    await db.query<any>(
      "SELECT (payment_reserve_venue_sale($1,$2,$3,$4,$5,$6,true)).*",
      args,
    )
  ).rows[0];
  expect(order).toMatchObject({
    provider: "square",
    processor_connection_id: connection,
    status: "pending",
    account_id: `square:${connection}`,
  });
  expect(
    (
      await db.query<any>("SELECT stock FROM venue_products WHERE id=$1", [
        product,
      ])
    ).rows[0].stock,
  ).toBe(5);
  expect(
    (
      await db.query<any>(
        "SELECT payment_provider FROM venue_sales WHERE id=$1",
        [order.venue_sale_id],
      )
    ).rows[0].payment_provider,
  ).toBe("square");
  const retry = (
    await db.query<any>(
      "SELECT (payment_reserve_venue_sale($1,$2,$3,$4,$5,$6,true)).id",
      args,
    )
  ).rows[0].id;
  expect(retry).toBe(order.id);
  await expect(
    db.query("UPDATE payment_orders SET account_id='acct_other' WHERE id=$1", [
      order.id,
    ]),
  ).rejects.toThrow("immutable");
  await expect(
    db.query(
      "SELECT venue_processor_select_location($1,$2,'another-location','Another')",
      [connection, owner],
    ),
  ).rejects.toThrow("payment history");
});
it("fulfills only confirmed payment, presents the correct provider and does not fulfill duplicate confirmations twice", async () => {
  await db.query(
    "UPDATE payment_orders SET checkout_session_id='link',processor_order_id='remote-order' WHERE id=$1",
    [order.id],
  );
  const args = [order.id, order.account_id];
  await expect(
    db.query(
      "SELECT payment_apply_result($1,$2,true,'link','paid',2499,'usd','payment',NULL)",
      args,
    ),
  ).rejects.toThrow();
  for (let i = 0; i < 2; i++)
    await db.query(
      "SELECT payment_apply_result($1,$2,true,'link','paid',2500,'usd','payment',NULL)",
      args,
    );
  expect(
    (
      await db.query<any>("SELECT stock FROM venue_products WHERE id=$1", [
        product,
      ])
    ).rows[0].stock,
  ).toBe(4);
  const receipt = (
    await db.query<any>(
      "SELECT venue_sale_receipt(receipt_token) data FROM venue_sales WHERE id=$1",
      [order.venue_sale_id],
    )
  ).rows[0].data;
  expect(receipt).toMatchObject({ provider: "square", status: "paid" });
});
it("routes court walk-ins and lesson deposits to Square while retaining court and coach holds", async () => {
  const court = id(40),
    coach = id(41);
  await db.query("INSERT INTO groups(id,venue_id) VALUES($1,$2)", [
    id(45),
    venue,
  ]);
  await db.query(
    "INSERT INTO venue_module_access VALUES($1,'court_booking','existing_venue',true,NULL,now())",
    [venue],
  );
  await db.query("UPDATE venues SET timezone='UTC' WHERE id=$1", [venue]);
  await db.query(
    "INSERT INTO venue_courts(id,venue_id,name,is_active,hourly_rate) VALUES($1,$2,'Court',true,30)",
    [court, venue],
  );
  const day = (await db.query<any>("SELECT (current_date+3)::text AS date"))
    .rows[0].date;
  const walk = (
    await db.query<any>(
      "SELECT (payment_reserve_venue_walkin($1,$2,NULL,$3,$4,$5,3000,$6,true)).*",
      [owner, customer, court, day + "T09:00:00Z", day + "T10:00:00Z", id(42)],
    )
  ).rows[0];
  expect(walk.provider).toBe("square");
  await db.query(
    "INSERT INTO venue_coaches(id,venue_id,name,hourly_rate,availability) VALUES($1,$2,'Coach',80,$3)",
    [
      coach,
      venue,
      JSON.stringify(
        Array.from({ length: 7 }, (_, weekday) => ({
          weekday,
          start_minute: 480,
          end_minute: 1200,
        })),
      ),
    ],
  );
  const appointment = (
    await as(
      owner,
      "SELECT * FROM venue_appointment_save($1,NULL,NULL,$2,$3)",
      [
        venue,
        JSON.stringify({
          customer_id: customer,
          kind: "lesson",
          title: "Lesson",
          coach_id: coach,
          court_ids: [court],
          start_time: day + "T12:00:00Z",
          end_time: day + "T13:00:00Z",
          total_cents: 8000,
          deposit_cents: 5000,
          tax_inclusive: true,
        }),
        id(43),
      ],
    )
  )[0];
  const lesson = (
    await db.query<any>(
      "SELECT (payment_reserve_venue_appointment($1,$2,$3,8000,$4,true)).*",
      [owner, appointment.id, appointment.version, id(44)],
    )
  ).rows[0];
  expect(lesson).toMatchObject({
    provider: "square",
    amount_cents: 8000,
    status: "pending",
  });
  for (const payment of [walk, lesson]) {
    await db.query(
      "UPDATE payment_orders SET checkout_session_id=$2 WHERE id=$1",
      [payment.id, "link-" + payment.id],
    );
    await db.query(
      "SELECT payment_apply_result($1,$2,true,$3,'paid',$4,'usd',$5,NULL)",
      [
        payment.id,
        payment.account_id,
        "link-" + payment.id,
        payment.amount_cents,
        "payment-" + payment.id,
      ],
    );
  }
  expect(
    (
      await db.query<any>("SELECT status FROM venue_visits WHERE sale_id=$1", [
        walk.venue_sale_id,
      ])
    ).rows[0].status,
  ).toBe("expected");
  expect(
    (
      await db.query<any>("SELECT status FROM venue_appointments WHERE id=$1", [
        appointment.id,
      ])
    ).rows[0].status,
  ).toBe("confirmed");
  expect(
    (
      await db.query(
        "SELECT id FROM group_events WHERE venue_appointment_id=$1",
        [appointment.id],
      )
    ).rows,
  ).toHaveLength(1);
  // Match the venue's calendar day, even when the runner has passed midnight.
  const reportDay = (await db.query<any>("SELECT (now() AT TIME ZONE timezone)::date::text d FROM venues WHERE id=$1", [venue])).rows[0].d;
  const report = (
    await as(
      owner,
      "SELECT venue_operating_report($1,$2,$2) data",
      [venue, reportDay],
    )
  )[0].data;
  expect(report).toMatchObject({
    square_cents: 13500,
    stripe_cents: 0,
    cash_cents: 0,
  });
});
it("pauses new payments without changing existing payment references or credential access for reconciliation", async () => {
  await db.query(
    "UPDATE venue_processor_connections SET status='paused' WHERE id=$1",
    [connection],
  );
  await expect(
    db.query("SELECT payment_reserve_venue_sale($1,$2,$3,1,2500,$4,true)", [
      owner,
      customer,
      product,
      id(11),
    ]),
  ).rejects.toThrow("Square needs attention");
  const credentials = (
    await db.query<any>("SELECT venue_processor_credentials($1) data", [
      connection,
    ])
  ).rows[0].data;
  expect(credentials.credentials.access_token).toBe("private-access");
  await db.query(
    "INSERT INTO venue_payment_accounts(venue_id,livemode,account_id,connected_by,charges_enabled,payouts_enabled,card_payments_active) VALUES($1,true,'acct_original',$2,true,true,true)",
    [venue, owner],
  );
  await db.query("SELECT venue_processor_set_desk($1,$2,'stripe')", [
    venue,
    owner,
  ]);
  expect(
    (
      await db.query<any>(
        "SELECT provider,account_id FROM payment_orders WHERE id=$1",
        [order.id],
      )
    ).rows[0],
  ).toEqual({ provider: "square", account_id: order.account_id });
});
it("prevents a transferred venue owner from reusing a previous owner connection", async () => {
  await db.query("UPDATE venues SET owner_id=$1 WHERE id=$2", [
    stranger,
    venue,
  ]);
  await expect(
    db.query(
      "SELECT venue_processor_select_location($1,$2,'location','Main')",
      [connection, stranger],
    ),
  ).rejects.toThrow("owner or location");
  await expect(
    db.query("SELECT venue_processor_set_desk($1,$2,'square')", [
      venue,
      stranger,
    ]),
  ).rejects.toThrow("verify a live");
});
