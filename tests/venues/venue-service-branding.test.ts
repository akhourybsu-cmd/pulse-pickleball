import { beforeAll, afterAll, it, expect } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { venueSuiteDatabase } from "../helpers/venueSuiteDatabase";
const id = (n: number) =>
  `73000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
let db: PGlite, token: string, saleToken: string;
async function asGuest(sql: string, args: unknown[] = []) {
  await db.exec("SET ROLE anon");
  try {
    return (await db.query<any>(sql, args)).rows;
  } finally {
    await db.exec("RESET ROLE");
  }
}
beforeAll(async () => {
  db = await venueSuiteDatabase();
  await db.query("INSERT INTO auth.users VALUES($1)", [id(1)]);
  await db.query(
    "INSERT INTO venues(id,name,owner_id,is_active,logo_crop) VALUES($1,'Venue One',$2,true,$3)",
    [id(2), id(1), JSON.stringify({ x: 25, y: 75, zoom: 2 })],
  );
  await db.query(
    "INSERT INTO venue_payment_settings(venue_id,support_email) VALUES($1,'desk@venue.example')",
    [id(2)],
  );
  await db.query(
    "INSERT INTO venue_customers(id,venue_id,first_name) VALUES($1,$2,'Player')",
    [id(3), id(2)],
  );
  token = (
    await db.query<any>(
      "INSERT INTO venue_visit_links(venue_id,customer_id,created_by) VALUES($1,$2,$3) RETURNING token",
      [id(2), id(3), id(1)],
    )
  ).rows[0].token;
  await db.query(
    "INSERT INTO venue_products(id,venue_id,name,kind,price_cents) VALUES($1,$2,'Visit pass','visit_pass',500)",
    [id(4), id(2)],
  );
  await db.query(
    "INSERT INTO venue_payment_settings(venue_id,cancellation_policy) VALUES($1,'Contact venue staff before arrival for cancellations.') ON CONFLICT(venue_id) DO UPDATE SET cancellation_policy=excluded.cancellation_policy",
    [id(2)],
  );
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [
    id(1),
  ]);
  saleToken = (
    await db.query<any>(
      "SELECT (venue_cash_sale($1,$2,1,500,$3,true)).receipt_token token",
      [id(3), id(4), id(5)],
    )
  ).rows[0].token;
  await db.exec("SELECT set_config('request.jwt.claim.sub','',false)");
}, 30000);
afterAll(() => db?.close());
it("brands valid waiver and receipt tokens with the venue contact, excluding financial account details", async () => {
  for (const [fn, t] of [
    ["venue_visit_document_view", token],
    ["venue_sale_receipt", saleToken],
  ]) {
    const data = (await asGuest(`SELECT ${fn}($1) data`, [t]))[0].data;
    expect(data.brand.logo_crop).toEqual({ x: 25, y: 75, zoom: 2 });
    expect(data.venue_contact).toMatchObject({
      name: "Venue One",
      email: "desk@venue.example",
    });
    expect(JSON.stringify(data)).not.toMatch(/owner_id|secret_id|account_id/);
  }
});
it("retains token expiry and revocation checks and blocks direct access to internal projections", async () => {
  await expect(
    asGuest("SELECT venue_visit_document_view($1)", [id(99)]),
  ).rejects.toThrow();
  await expect(
    asGuest("SELECT venue_sale_receipt($1)", [id(99)]),
  ).rejects.toThrow();
  await db.query(
    "UPDATE venue_visit_links SET revoked_at=now() WHERE token=$1",
    [token],
  );
  await expect(
    asGuest("SELECT venue_visit_document_view($1)", [token]),
  ).rejects.toThrow();
  await expect(
    asGuest("SELECT venue_service_contact($1)", [id(2)]),
  ).rejects.toThrow(/permission denied/);
  await expect(
    asGuest("SELECT venue_sale_receipt_before_branding($1)", [saleToken]),
  ).rejects.toThrow(/permission denied/);
});
