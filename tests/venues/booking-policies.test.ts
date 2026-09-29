import { readFileSync } from "node:fs";
import { beforeAll, beforeEach, afterAll, it, expect } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { venueEventDatabase } from "../helpers/venueEventDatabase";
const id = (n: number) =>
  `50000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const owner = id(1),
  staff = id(2),
  venue = id(3),
  court = id(4),
  customer = id(5),
  product = id(6);
let db: PGlite, start: string, end: string, day: string;
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
beforeAll(async () => {
  db = await venueEventDatabase();
  for (const name of [
    "20260929010000_venue_attendance.sql",
    "20260929100000_venue_customer_records.sql",
    "20260929110000_venue_desk_sales.sql",
    "20260929120000_venue_booking_policies.sql",
  ])
    await db.exec(readFileSync("supabase/migrations/" + name, "utf8"));
}, 30000);
beforeEach(async () => {
  await db.exec(
    "TRUNCATE venues,auth.users,venue_courts,venue_staff,venue_module_access CASCADE; SELECT set_config('test.mfa_required','',false)"
  );
  await db.query("INSERT INTO auth.users VALUES($1),($2)", [owner, staff]);
  await db.query(
    "INSERT INTO venues(id,name,owner_id,timezone,is_active) VALUES($1,'Venue',$2,'UTC',true)",
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
    "INSERT INTO venue_courts(id,venue_id,name,is_active,hourly_rate) VALUES($1,$2,'Court 1',true,30)",
    [court, venue]
  );
  await db.query(
    "INSERT INTO venue_customers(id,venue_id,first_name) VALUES($1,$2,'Member')",
    [customer, venue]
  );
  day = (await db.query<any>("SELECT (current_date+3)::text AS date")).rows[0]
    .date;
  start = day + "T09:30:00Z";
  end = day + "T10:30:00Z";
});
afterAll(async () => {
  await db?.close();
});
async function band(court_id: string | null = court) {
  await as(owner, "SELECT venue_rate_save($1,NULL,NULL,$2)", [
    venue,
    {
      name: "Peak",
      court_id,
      days: [0, 1, 2, 3, 4, 5, 6],
      start_minute: 600,
      end_minute: 720,
      hourly_cents: 6000,
    },
  ]);
}
const quote = async () =>
  (
    await db.query<any>("SELECT venue_court_pricing($1,$2,$3,$4) data", [
      court,
      start,
      end,
      customer,
    ])
  ).rows[0].data;
it("prices a booking spanning base and peak rates by its actual minutes", async () => {
  await band();
  expect((await quote()).amount_cents).toBe(4500);
});
it("rejects overlapping rate windows and front-desk rate edits", async () => {
  await band();
  await expect(band()).rejects.toThrow(/overlap/);
  await expect(
    as(staff, "SELECT venue_rate_save($1,NULL,NULL,$2)", [
      venue,
      { name: "Unauthorized" },
    ])
  ).rejects.toThrow(/management access/);
});
it("prefers a court-specific rate over the general venue rate", async () => {
  await band(null);
  await as(owner, "SELECT venue_rate_save($1,NULL,NULL,$2)", [
    venue,
    {
      name: "Court special",
      court_id: court,
      days: [0, 1, 2, 3, 4, 5, 6],
      start_minute: 600,
      end_minute: 720,
      hourly_cents: 4000,
    },
  ]);
  expect((await quote()).amount_cents).toBe(3500);
});
it("applies only a paid, valid membership discount", async () => {
  await band();
  await db.query(
    "INSERT INTO venue_products(id,venue_id,name,kind,price_cents,member_discount_percent) VALUES($1,$2,'Membership','membership',5000,20)",
    [product, venue]
  );
  await db.query(
    "INSERT INTO venue_payment_settings(venue_id,cancellation_policy) VALUES($1,'Venue policy supplied for testing.')",
    [venue]
  );
  await as(owner, "SELECT venue_cash_sale($1,$2,1,5000,$3,true)", [
    customer,
    product,
    id(8),
  ]);
  expect((await quote()).amount_cents).toBe(3600);
  await db.exec("UPDATE venue_entitlements SET revoked_at=now()");
  expect((await quote()).amount_cents).toBe(4500);
});
it("enforces minimum duration and advance booking limits", async () => {
  await as(owner, "SELECT venue_booking_rules_save($1,NULL,$2)", [
    venue,
    {
      minimum_minutes: 90,
      maximum_minutes: 180,
      booking_days: 2,
      member_booking_days: 14,
      lead_minutes: 60,
      cancellation_hours: 24,
    },
  ]);
  await expect(quote()).rejects.toThrow(/duration/);
  end = day + "T11:00:00Z";
  await expect(quote()).rejects.toThrow(/advance booking/);
});
it("blocks holiday bookings and reopens the date when management removes the closure", async () => {
  await as(owner, "SELECT venue_holiday_save($1,$2,$3)", [
    venue,
    day,
    "Holiday closure",
  ]);
  await expect(quote()).rejects.toThrow(/closed/);
  await as(owner, "SELECT venue_holiday_save($1,$2,NULL)", [venue, day]);
  expect((await quote()).amount_cents).toBe(3000);
});
