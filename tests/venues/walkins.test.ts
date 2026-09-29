import { readFileSync } from "node:fs";
import { beforeAll, beforeEach, afterAll, it, expect } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { venueEventDatabase } from "../helpers/venueEventDatabase";
const id = (n: number) =>
  `60000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const owner = id(1),
  staff = id(2),
  player = id(3),
  venue = id(4),
  court = id(5),
  customer = id(6),
  event = id(7),
  group = id(8);
let db: PGlite, start: string, end: string;
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
    "20260928200000_venue_program_roster.sql",
    "20260929010000_venue_attendance.sql",
    "20260929100000_venue_customer_records.sql",
    "20260929110000_venue_desk_sales.sql",
    "20260929120000_venue_booking_policies.sql",
    "20260929130000_venue_walkins.sql",
    "20260929131000_venue_visit_integration.sql",
  ])
    await db.exec(readFileSync("supabase/migrations/" + name, "utf8"));
}, 30000);
beforeEach(async () => {
  await db.exec(
    "TRUNCATE venues,auth.users,groups,group_events,venue_courts,venue_staff,venue_module_access CASCADE; SELECT set_config('test.mfa_required','',false)"
  );
  await db.query("INSERT INTO auth.users VALUES($1),($2),($3)", [
    owner,
    staff,
    player,
  ]);
  await db.query(
    "INSERT INTO venues(id,name,owner_id,timezone,is_active) VALUES($1,'Venue',$2,'UTC',true)",
    [venue, owner]
  );
  await db.query(
    "INSERT INTO venue_staff VALUES($1,$2,true,'active','staff')",
    [venue, staff]
  );
  await db.query(
    "INSERT INTO venue_module_access VALUES($1,'facility_tools','existing_venue',true,NULL,now()),($1,'court_booking','existing_venue',true,NULL,now())",
    [venue]
  );
  await db.query("INSERT INTO groups(id,venue_id) VALUES($1,$2)", [
    group,
    venue,
  ]);
  await db.query(
    "INSERT INTO group_members(group_id,user_id,status) VALUES($1,$2,'active')",
    [group, player]
  );
  await db.query(
    "INSERT INTO venue_courts(id,venue_id,name,is_active,hourly_rate) VALUES($1,$2,'Court 1',true,30)",
    [court, venue]
  );
  await db.query(
    "INSERT INTO venue_customers(id,venue_id,first_name) VALUES($1,$2,'Guest')",
    [customer, venue]
  );
  await db.query(
    "INSERT INTO venue_payment_settings(venue_id,cancellation_policy) VALUES($1,'Venue policy supplied for testing.')",
    [venue]
  );
  const day = (await db.query<any>("SELECT (current_date+3)::text AS date"))
    .rows[0].date;
  start = day + "T09:30:00Z";
  end = day + "T10:30:00Z";
  await db.exec("BEGIN");
  await db.query(
    "INSERT INTO group_events(id,venue_id,group_id,created_by,title,event_format,start_time,end_time,capacity,price_cents) VALUES($1,$2,$3,$4,'Open play','open_play',$5,$6,1,0)",
    [event, venue, group, owner, start, end]
  );
  await db.query(
    "INSERT INTO group_events(venue_id,group_id,created_by,title,event_format,start_time,end_time,venue_court_id,parent_event_id) VALUES($1,$2,$3,'Open play','program_hold',$4,$5,$6,$7)",
    [venue, group, owner, start, end, court, event]
  );
  await db.exec("COMMIT");
});
afterAll(async () => {
  await db?.close();
});
const book = () =>
  as(
    staff,
    "SELECT * FROM venue_walkin_book($1,$2,NULL,NULL,NULL,'free',NULL,0,$3)",
    [customer, event, id(20)]
  );
it("reserves an event seat once and prevents a later online registration exceeding capacity", async () => {
  const visit = (await book())[0];
  expect(visit.status).toBe("expected");
  expect((await book())[0].id).toBe(visit.id);
  await expect(
    as(
      player,
      "INSERT INTO group_event_rsvps(event_id,user_id,status) VALUES($1,$2,'going')",
      [event, player]
    )
  ).rejects.toThrow(/no unreserved places/);
});
it("rejects unauthorized desk bookings and event registrations already held by the player", async () => {
  await expect(
    as(
      player,
      "SELECT venue_walkin_book($1,$2,NULL,NULL,NULL,'free',NULL,0,$3)",
      [customer, event, id(20)]
    )
  ).rejects.toThrow(/access required/);
  await db.query("UPDATE venue_customers SET user_id=$1 WHERE id=$2", [
    player,
    customer,
  ]);
  await db.query(
    "INSERT INTO group_event_rsvps(event_id,user_id,status) VALUES($1,$2,'going')",
    [event, player]
  );
  await expect(book()).rejects.toThrow(/already registered/);
});
it("requires waivers before check-in, then uses attendance versions to prevent lost updates", async () => {
  const visit = (await book())[0];
  await as(owner, "SELECT venue_document_publish($1,$2,$3,true)", [
    venue,
    "Venue document",
    "Test fixture supplied wording for venue participants.",
  ]);
  await expect(
    as(staff, "SELECT venue_visit_status($1,'checked_in',0)", [visit.id])
  ).rejects.toThrow(/required venue documents/);
  const token = (
    await as(staff, "SELECT venue_visit_link($1) token", [customer])
  )[0].token;
  const doc = (await db.query<any>("SELECT id FROM venue_documents")).rows[0]
    .id;
  await db.query("SELECT venue_document_accept($1,$2,$3,true)", [
    token,
    doc,
    "Guest Participant",
  ]);
  await as(staff, "SELECT venue_visit_status($1,'checked_in',0)", [visit.id]);
  await expect(
    as(staff, "SELECT venue_visit_status($1,'expected',0)", [visit.id])
  ).rejects.toThrow(/changed on another desk/);
  expect(
    (await db.query<any>("SELECT checked_in_at FROM venue_visits")).rows[0]
      .checked_in_at
  ).toBeTruthy();
});
it("allocates a paid walk-in court in the shared calendar and releases it on cancellation", async () => {
  const s = new Date(start);
  s.setUTCHours(12);
  const t = new Date(s.getTime() + 3600000);
  const args = [customer, court, s.toISOString(), t.toISOString(), id(30)];
  const visit = (
    await as(
      staff,
      "SELECT * FROM venue_walkin_book($1,NULL,$2,$3,$4,'cash',NULL,3000,$5,true)",
      args
    )
  )[0];
  expect(visit.status).toBe("expected");
  expect(
    (
      await db.query<any>(
        "SELECT venue_court_id FROM group_events WHERE venue_visit_id=$1",
        [visit.id]
      )
    ).rows[0].venue_court_id
  ).toBe(court);
  await expect(
    as(staff, "SELECT venue_walkin_quote($1,NULL,$2,$3,$4)", args.slice(0, 4))
  ).rejects.toThrow(/already booked/);
  await expect(
    as(staff, "DELETE FROM group_events WHERE venue_visit_id=$1", [visit.id])
  ).rejects.toThrow(/Cancel this desk visit/);
  await as(
    staff,
    "SELECT venue_visit_status($1,'canceled',$2,'Player canceled at desk')",
    [visit.id, visit.version]
  );
  expect(
    (
      await db.query("SELECT id FROM group_events WHERE venue_visit_id=$1", [
        visit.id,
      ])
    ).rows
  ).toHaveLength(0);
  expect(
    (await db.query<any>("SELECT status FROM venue_sales")).rows[0].status
  ).toBe("paid");
});
it("uses half an hour from a court-hour pack for a 30-minute reservation", async () => {
  await db.query(
    "INSERT INTO venue_products(id,venue_id,name,kind,price_cents,units) VALUES($1,$2,'Court pack','court_hours',5000,2)",
    [id(40), venue]
  );
  await as(staff, "SELECT venue_cash_sale($1,$2,1,5000,$3,true)", [
    customer,
    id(40),
    id(41),
  ]);
  const pass = (await db.query<any>("SELECT id FROM venue_entitlements"))
    .rows[0].id;
  const s = new Date(start);
  s.setUTCHours(12);
  const t = new Date(s.getTime() + 1800000);
  await as(
    staff,
    "SELECT venue_walkin_book($1,NULL,$2,$3,$4,'pass',$5,1500,$6)",
    [customer, court, s.toISOString(), t.toISOString(), pass, id(42)]
  );
  expect(
    Number(
      (await db.query<any>("SELECT remaining_units FROM venue_entitlements"))
        .rows[0].remaining_units
    )
  ).toBe(1.5);
});
