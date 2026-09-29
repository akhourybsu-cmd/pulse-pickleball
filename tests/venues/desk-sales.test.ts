import { readFileSync } from "node:fs";
import { beforeAll, beforeEach, afterAll, it, expect, describe } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { venueEventDatabase } from "../helpers/venueEventDatabase";
const id = (n: number) =>
  `40000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const owner = id(1),
  staff = id(2),
  outsider = id(3),
  venue = id(4),
  customer = id(5),
  product = id(6);
let db: PGlite;
async function as(user: string, sql: string, args: unknown[] = []) {
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [user]);
  await db.exec("SET ROLE authenticated");
  try {
    return (await db.query<any>(sql, args)).rows;
  } finally {
    await db.exec(
      "RESET ROLE; SELECT set_config('request.jwt.claim.sub','',false)"
    );
  }
}
const sale = (request = id(20), quantity = 1, amount = 2500) =>
  as(staff, "SELECT * FROM venue_cash_sale($1,$2,$3,$4,$5,true)", [
    customer,
    product,
    quantity,
    amount,
    request,
  ]);
beforeAll(async () => {
  db = await venueEventDatabase();
  for (const name of [
    "20260929010000_venue_attendance.sql",
    "20260929100000_venue_customer_records.sql",
    "20260929110000_venue_desk_sales.sql",
  ])
    await db.exec(readFileSync("supabase/migrations/" + name, "utf8"));
}, 30000);
beforeEach(async () => {
  await db.exec(
    "TRUNCATE venues,auth.users,groups,group_members,venue_staff,venue_module_access CASCADE; SELECT set_config('test.mfa_required','',false)"
  );
  await db.query("INSERT INTO auth.users VALUES($1),($2),($3)", [
    owner,
    staff,
    outsider,
  ]);
  await db.query(
    "INSERT INTO venues(id,name,owner_id,timezone) VALUES($1,'Venue',$2,'America/New_York')",
    [venue, owner]
  );
  await db.query(
    "INSERT INTO venue_staff VALUES($1,$2,true,'active','staff')",
    [venue, staff]
  );
  await db.query(
    "INSERT INTO venue_module_access VALUES($1,'facility_tools','existing_venue',true,NULL,now())",
    [venue]
  );
  await db.query(
    "INSERT INTO venue_customers(id,venue_id,first_name) VALUES($1,$2,'Guest')",
    [customer, venue]
  );
  await db.query(
    "INSERT INTO venue_products(id,venue_id,name,kind,price_cents,units,stock) VALUES($1,$2,'Five visits','visit_pass',2500,5,NULL)",
    [product, venue]
  );
  await db.query(
    "INSERT INTO venue_payment_settings(venue_id,cancellation_policy,support_email,timezone,tax_inclusive_acknowledged) VALUES($1,'Venue cancellation policy supplied for testing.','venue@example.test','America/New_York',true)",
    [venue]
  );
});
afterAll(async () => {
  await db?.close();
});
describe("desk sale and entitlement integrity", () => {
  async function connected() {
    await db.query(
      "UPDATE venues SET verification_approved_at=now() WHERE id=$1",
      [venue]
    );
    await db.query(
      "INSERT INTO venue_payment_accounts(venue_id,livemode,account_id,connected_by,charges_enabled,payouts_enabled,card_payments_active) VALUES($1,true,'acct_venue',$2,true,true,true)",
      [venue, owner]
    );
  }
  it("fulfills a verified guest card payment once and rejects mismatched amounts", async () => {
    await connected();
    const o = (
      await db.query<any>(
        "SELECT * FROM payment_reserve_venue_sale($1,$2,$3,1,2500,$4,true)",
        [staff, customer, product, id(60)]
      )
    ).rows[0];
    expect(o.buyer_id).toBeNull();
    expect(
      (await db.query("SELECT * FROM venue_entitlements")).rows
    ).toHaveLength(0);
    await expect(
      db.query(
        "SELECT payment_apply_result($1,'acct_venue',true,'cs_desk','paid',100,'usd','pi_desk','cus_guest')",
        [o.id]
      )
    ).rejects.toThrow(/verification mismatch/);
    const pay = () =>
      db.query(
        "SELECT payment_apply_result($1,'acct_venue',true,'cs_desk','paid',2500,'usd','pi_desk','cus_guest')",
        [o.id]
      );
    await pay();
    await pay();
    expect(
      (await db.query("SELECT * FROM venue_entitlements")).rows
    ).toHaveLength(1);
    expect(
      (await db.query<any>("SELECT status FROM venue_sales")).rows[0].status
    ).toBe("paid");
  });
  it("extends memberships only for matching settled renewals and deduplicates invoices", async () => {
    await connected();
    await db.query("UPDATE venue_customers SET user_id=$1 WHERE id=$2", [
      outsider,
      customer,
    ]);
    await db.exec(
      "UPDATE venue_products SET kind='membership',units=1,billing_cadence='monthly'"
    );
    const o = (
      await db.query<any>(
        "SELECT * FROM payment_reserve_venue_sale($1,$2,$3,1,2500,$4,true)",
        [staff, customer, product, id(61)]
      )
    ).rows[0];
    await db.query(
      "SELECT payment_apply_result($1,'acct_venue',true,'cs_member','paid',2500,'usd','pi_first','cus_member','sub_member',now()+interval '1 month')",
      [o.id]
    );
    await expect(
      db.exec(
        "SELECT payment_record_renewal('sub_member','in_next',2000,'usd','pi_next','cus_member',now()+interval '2 months')"
      )
    ).rejects.toThrow(/Renewal payment mismatch/);
    const renew = () =>
      db.exec(
        "SELECT payment_record_renewal('sub_member','in_next',2500,'usd','pi_next','cus_member',now()+interval '2 months')"
      );
    await renew();
    await renew();
    expect(
      (await db.query("SELECT * FROM venue_entitlements")).rows
    ).toHaveLength(2);
    expect((await db.query("SELECT * FROM venue_sales")).rows).toHaveLength(2);
    expect(
      (
        await db.query<any>(
          "SELECT paid_through>now()+interval '1 month' AS extended FROM payment_subscriptions"
        )
      ).rows[0].extended
    ).toBe(true);
  });
  it("records cash once, decrements stock once and issues one pass on retry", async () => {
    const first = (await sale())[0];
    const again = (await sale())[0];
    expect(again.id).toBe(first.id);
    expect(first.status).toBe("paid");
    expect(
      (await db.query<any>("SELECT count(*)::integer n FROM venue_sales"))
        .rows[0].n
    ).toBe(1);
    const passes = (await db.query<any>("SELECT * FROM venue_entitlements"))
      .rows;
    expect(passes).toHaveLength(1);
    expect(Number(passes[0].remaining_units)).toBe(5);
    await expect(sale(id(20), 2, 5000)).rejects.toThrow(/request changed/);
  });
  it("refuses altered prices, unavailable stock and unauthorized sales", async () => {
    await expect(sale(id(20), 1, 1)).rejects.toThrow(/Price changed/);
    await db.exec("UPDATE venue_products SET kind='merchandise',stock=2");
    await expect(sale(id(20), 3, 7500)).rejects.toThrow(/stock/);
    await expect(
      as(outsider, "SELECT venue_cash_sale($1,$2,1,2500,$3,true)", [
        customer,
        product,
        id(20),
      ])
    ).rejects.toThrow(/access required/);
    await expect(
      as(staff, "SELECT venue_sale_fulfill($1)", [id(22)])
    ).rejects.toThrow(/permission denied/);
    await expect(
      as(staff, "UPDATE venue_sales SET status='paid'")
    ).rejects.toThrow(/permission denied/);
  });
  it("redeems passes with retry safety and rejects overdrawn or expired balances", async () => {
    await sale();
    const pass = (await db.query<any>("SELECT id FROM venue_entitlements"))
      .rows[0].id;
    const use = () =>
      as(staff, "SELECT * FROM venue_use_entitlement($1,2,$2,$3)", [
        pass,
        id(30),
        "Two event admissions",
      ]);
    expect(Number((await use())[0].remaining_units)).toBe(3);
    expect(Number((await use())[0].remaining_units)).toBe(3);
    await expect(
      as(staff, "SELECT venue_use_entitlement($1,4,$2,$3)", [
        pass,
        id(31),
        "Four admissions",
      ])
    ).rejects.toThrow(/insufficient/);
    await db.query(
      "UPDATE venue_entitlements SET expires_at=now()-interval '1 second' WHERE id=$1",
      [pass]
    );
    await expect(
      as(staff, "SELECT venue_use_entitlement($1,1,$2,$3)", [
        pass,
        id(32),
        "One admission",
      ])
    ).rejects.toThrow(/insufficient/);
  });
  it("restricts cash refunds to owners, preserves partial balances and revokes fully refunded passes", async () => {
    const s = (await sale())[0];
    await expect(
      as(staff, "SELECT venue_cash_refund($1,2500,$2,$3,true)", [
        s.id,
        "Returned in full",
        id(40),
      ])
    ).rejects.toThrow(/owner access/);
    await as(owner, "SELECT venue_cash_refund($1,1000,$2,$3,true)", [
      s.id,
      "Partially returned",
      id(40),
    ]);
    await as(owner, "SELECT venue_cash_refund($1,1000,$2,$3,true)", [
      s.id,
      "Partially returned",
      id(40),
    ]);
    expect(
      (await db.query<any>("SELECT refunded_cents FROM venue_sales")).rows[0]
        .refunded_cents
    ).toBe(1000);
    await as(owner, "SELECT venue_cash_refund($1,1500,$2,$3,true)", [
      s.id,
      "Remaining amount returned",
      id(41),
    ]);
    expect(
      (await db.query<any>("SELECT revoked_at FROM venue_entitlements")).rows[0]
        .revoked_at
    ).toBeTruthy();
  });
  it("reconciles the venue-local cash day and refuses a stale close or later cash entry", async () => {
    await sale();
    const day = (
      await db.query<any>(
        "SELECT (now() AT TIME ZONE 'America/New_York')::date::text AS day"
      )
    ).rows[0].day;
    const w = (
      await as(owner, "SELECT venue_desk_workspace($1,$2) data", [venue, day])
    )[0].data;
    expect(w.cash_expected_cents).toBe(2500);
    await expect(
      as(owner, "SELECT venue_cash_close($1,$2,2000,2500,$3)", [
        venue,
        day,
        "Counted drawer",
      ])
    ).rejects.toThrow(/totals changed/);
    await as(owner, "SELECT venue_cash_close($1,$2,2500,2500,$3)", [
      venue,
      day,
      "Counted drawer",
    ]);
    await expect(sale(id(21))).rejects.toThrow(/cash day is closed/);
  });
  it("does not grant a recurring membership for cash or an unlinked guest", async () => {
    await db.query(
      "UPDATE venue_products SET kind='membership',units=1,billing_cadence='monthly'"
    );
    await expect(sale()).rejects.toThrow(/Monthly auto-renewal/);
  });
  it("exposes only receipt information through an unguessable receipt token", async () => {
    const s = (await sale())[0];
    await db.exec("SET ROLE anon");
    try {
      const data = (
        await db.query<any>("SELECT venue_sale_receipt($1) data", [
          s.receipt_token,
        ])
      ).rows[0].data;
      expect(data.amount_cents).toBe(2500);
      expect(data.status).toBe("paid");
      expect(data.customer_id).toBeUndefined();
      expect(data.cashier_id).toBeUndefined();
    } finally {
      await db.exec("RESET ROLE");
    }
  });
});
