import { beforeAll, beforeEach, afterAll, it, expect } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { venueSuiteDatabase } from "../helpers/venueSuiteDatabase";
const id = (n: number) =>
  `70000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const owner = id(1),
  staff = id(2),
  player = id(3),
  other = id(4),
  venue = id(5),
  group = id(6),
  court = id(7),
  event = id(8),
  rsvp = id(9),
  otherRsvp = id(10);
let db: PGlite;
async function as(
  user: string,
  sql: string,
  args: unknown[] = [],
  role = "authenticated"
) {
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [user]);
  await db.exec(`SET ROLE ${role}`);
  try {
    return (await db.query<any>(sql, args)).rows;
  } finally {
    await db.exec(
      "RESET ROLE; SELECT set_config('request.jwt.claim.sub','',false)"
    );
  }
}
beforeAll(async () => {
  db = await venueSuiteDatabase();
}, 30000);
beforeEach(async () => {
  await db.exec(
    "TRUNCATE venues,auth.users,groups,group_events,venue_courts,venue_staff,venue_module_access CASCADE; TRUNCATE change_notifications,notification_preferences,group_notification_prefs; SELECT set_config('test.mfa_required','',false)"
  );
  await db.query("INSERT INTO auth.users VALUES($1),($2),($3),($4)", [
    owner,
    staff,
    player,
    other,
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
    "INSERT INTO group_members(group_id,user_id,status) VALUES($1,$2,'active'),($1,$3,'active')",
    [group, player, other]
  );
  await db.query(
    "INSERT INTO venue_courts(id,venue_id,name,is_active) VALUES($1,$2,'Court 1',true)",
    [court, venue]
  );
  await db.exec("BEGIN");
  await db.query(
    "INSERT INTO group_events(id,venue_id,group_id,created_by,title,event_format,start_time,end_time,capacity) VALUES($1,$2,$3,$4,'Open play','open_play',now()+interval '30 minutes',now()+interval '90 minutes',10)",
    [event, venue, group, owner]
  );
  await db.query(
    "INSERT INTO group_events(venue_id,group_id,created_by,title,event_format,start_time,end_time,venue_court_id,parent_event_id) SELECT venue_id,group_id,created_by,title,'program_hold',start_time,end_time,$1,id FROM group_events WHERE id=$2",
    [court, event]
  );
  await db.exec("COMMIT");
  await db.query(
    "INSERT INTO group_event_rsvps(id,event_id,user_id,status) VALUES($1,$2,$3,'going'),($4,$2,$5,'going')",
    [rsvp, event, player, otherRsvp, other]
  );
});
afterAll(async () => {
  await db?.close();
});

it("keeps weekly wall-clock times across the fall daylight-saving transition", async () => {
  await db.query("UPDATE venues SET timezone='America/New_York' WHERE id=$1", [
    venue,
  ]);
  // First Sunday of November in the next year, so this is always a future series.
  const boundary = (
    await db.query<any>(
      "SELECT (d + ((7-extract(dow FROM d)::integer)%7))::text AS day FROM (SELECT make_date(extract(year FROM now())::integer+1,11,1) d)x"
    )
  ).rows[0].day;
  await db.exec("BEGIN");
  await db.query(
    "UPDATE group_events SET start_time=(($1::date-7)+time '09:00') AT TIME ZONE 'America/New_York',end_time=(($1::date-7)+time '10:00') AT TIME ZONE 'America/New_York',series_id=$2 WHERE id=$3 OR parent_event_id=$3",
    [boundary, id(50), event]
  );
  await db.query(
    "INSERT INTO group_events(id,venue_id,group_id,created_by,title,event_format,start_time,end_time,capacity,series_id) SELECT $1,venue_id,group_id,created_by,title,event_format,($2::date+time '09:00') AT TIME ZONE 'America/New_York',($2::date+time '10:00') AT TIME ZONE 'America/New_York',capacity,series_id FROM group_events WHERE id=$3",
    [id(51), boundary, event]
  );
  await db.query(
    "INSERT INTO group_events(venue_id,group_id,created_by,title,event_format,start_time,end_time,venue_court_id,parent_event_id) SELECT venue_id,group_id,created_by,title,'program_hold',start_time,end_time,$1,id FROM group_events WHERE id=$2",
    [court, id(51)]
  );
  await db.exec("COMMIT");
  const preview = (
    await as(owner, "SELECT venue_series_preview($1,'all') data", [event])
  )[0].data;
  const changes = (
    await db.query<any>(
      "SELECT jsonb_build_object('start_time',start_time+interval '1 hour','end_time',end_time+interval '1 hour','registration_closes_at',start_time+interval '1 hour') d FROM group_events WHERE id=$1",
      [event]
    )
  ).rows[0].d;
  await as(owner, "SELECT venue_series_apply($1,'all',$2,$3,$4)", [
    event,
    JSON.stringify(preview),
    JSON.stringify(changes),
    [court],
  ]);
  const times = (
    await db.query<any>(
      "SELECT to_char(start_time AT TIME ZONE 'America/New_York','HH24:MI') local_time,extract(hour FROM start_time AT TIME ZONE 'UTC')::integer utc_hour FROM group_events WHERE id IN ($1,$2) ORDER BY start_time",
      [event, id(51)]
    )
  ).rows;
  expect(times).toEqual([
    { local_time: "10:00", utc_hour: 14 },
    { local_time: "10:00", utc_hour: 15 },
  ]);
});

it("counts cash and card receipts once and attributes refunds to the original sale", async () => {
  await db.query(
    "INSERT INTO venue_customers(id,venue_id,first_name) VALUES($1,$2,'Player')",
    [id(60), venue]
  );
  await db.query(
    "INSERT INTO venue_products(id,venue_id,name,kind,price_cents,units) VALUES($1,$2,'Five visits','visit_pass',2500,5)",
    [id(61), venue]
  );
  await db.query(
    "INSERT INTO venue_payment_settings(venue_id,cancellation_policy,tax_inclusive_acknowledged) VALUES($1,'Venue policy for test purchases.',true)",
    [venue]
  );
  await db.query(
    "UPDATE venues SET verification_approved_at=now() WHERE id=$1",
    [venue]
  );
  await db.query(
    "INSERT INTO venue_payment_accounts(venue_id,livemode,account_id,connected_by,charges_enabled,payouts_enabled,card_payments_active) VALUES($1,true,'acct_venue',$2,true,true,true)",
    [venue, owner]
  );
  await as(staff, "SELECT * FROM venue_cash_sale($1,$2,1,2500,$3,true)", [
    id(60),
    id(61),
    id(62),
  ]);
  const order = (
    await db.query<any>(
      "SELECT * FROM payment_reserve_venue_sale($1,$2,$3,1,2500,$4,true)",
      [staff, id(60), id(61), id(63)]
    )
  ).rows[0];
  await db.query(
    "SELECT payment_apply_result($1,'acct_venue',true,'cs_report','paid',2500,'usd','pi_report','cus_report')",
    [order.id]
  );
  await db.query(
    "UPDATE payment_orders SET refunded_cents=500,status='partially_refunded' WHERE id=$1",
    [order.id]
  );
  const day = (await db.query<any>("SELECT current_date::text d")).rows[0].d;
  const r = (
    await as(owner, "SELECT venue_operating_report($1,$2,$2) data", [
      venue,
      day,
    ])
  )[0].data;
  expect(r).toEqual(
    expect.objectContaining({
      gross_cents: 5000,
      refunded_cents: 500,
      net_cents: 4500,
      cash_cents: 2500,
      stripe_cents: 2000,
    })
  );
});

it("moves an entire series in venue local time and cancels a selected exception", async () => {
  await db.query("UPDATE venues SET timezone='America/New_York' WHERE id=$1", [
    venue,
  ]);
  await db.query("UPDATE group_events SET series_id=$1 WHERE id=$2", [
    id(50),
    event,
  ]);
  await db.exec("BEGIN");
  await db.query(
    "INSERT INTO group_events(id,venue_id,group_id,created_by,title,event_format,start_time,end_time,capacity,series_id) SELECT $1,venue_id,group_id,created_by,title,event_format,start_time+interval '7 days',end_time+interval '7 days',capacity,series_id FROM group_events WHERE id=$2",
    [id(51), event]
  );
  await db.query(
    "INSERT INTO group_events(venue_id,group_id,created_by,title,event_format,start_time,end_time,venue_court_id,parent_event_id) SELECT venue_id,group_id,created_by,title,'program_hold',start_time,end_time,$1,id FROM group_events WHERE id=$2",
    [court, id(51)]
  );
  await db.exec("COMMIT");
  const preview = (
    await as(owner, "SELECT venue_series_preview($1,'all') data", [event])
  )[0].data;
  const changes = (
    await db.query<any>(
      "SELECT jsonb_build_object('title','New series title','start_time',start_time+interval '1 hour','end_time',end_time+interval '1 hour','registration_closes_at',start_time+interval '1 hour') d FROM group_events WHERE id=$1",
      [event]
    )
  ).rows[0].d;
  await as(owner, "SELECT venue_series_apply($1,'all',$2,$3,$4)", [
    event,
    JSON.stringify(preview),
    JSON.stringify(changes),
    [court],
  ]);
  expect(
    (
      await db.query<any>(
        "SELECT count(*)::integer n FROM group_events WHERE title='New series title'"
      )
    ).rows[0].n
  ).toBe(4);
  await expect(
    as(owner, "SELECT venue_series_apply($1,'all',$2,$3,$4)", [
      event,
      JSON.stringify(preview),
      JSON.stringify(changes),
      [court],
    ])
  ).rejects.toThrow(/series changed/);
  const latest = (
    await as(owner, "SELECT venue_series_preview($1,'all') data", [event])
  )[0].data;
  const day = (
    await db.query<any>(
      "SELECT (start_time AT TIME ZONE 'America/New_York')::date::text d FROM group_events WHERE id=$1",
      [id(51)]
    )
  ).rows[0].d;
  const newChanges = (
    await db.query<any>(
      "SELECT to_jsonb(e) d FROM group_events e WHERE id=$1",
      [event]
    )
  ).rows[0].d;
  await as(owner, "SELECT venue_series_apply($1,'all',$2,$3,$4,$5)", [
    event,
    JSON.stringify(latest),
    JSON.stringify(newChanges),
    [court],
    [day],
  ]);
  expect(
    (
      await db.query<any>("SELECT canceled_at FROM group_events WHERE id=$1", [
        id(51),
      ])
    ).rows[0].canceled_at
  ).toBeTruthy();
});
it("rolls back every occurrence when a reassigned court conflicts", async () => {
  const preview = (
    await as(owner, "SELECT venue_series_preview($1,'occurrence') data", [
      event,
    ])
  )[0].data;
  const changes = (
    await db.query<any>(
      "SELECT jsonb_build_object('title','Should roll back','start_time',start_time+interval '5 hours','end_time',end_time+interval '5 hours','registration_closes_at',start_time+interval '5 hours') d FROM group_events WHERE id=$1",
      [event]
    )
  ).rows[0].d;
  await db.query(
    "INSERT INTO group_events(venue_id,group_id,created_by,title,event_format,start_time,end_time,venue_court_id) SELECT venue_id,group_id,created_by,'Busy','reservation',start_time+interval '5 hours',end_time+interval '5 hours',$1 FROM group_events WHERE id=$2",
    [court, event]
  );
  await expect(
    as(owner, "SELECT venue_series_apply($1,'occurrence',$2,$3,$4)", [
      event,
      JSON.stringify(preview),
      JSON.stringify(changes),
      [court],
    ])
  ).rejects.toThrow(/conflict|overlap/);
  expect(
    (await db.query<any>("SELECT title FROM group_events WHERE id=$1", [event]))
      .rows[0].title
  ).toBe("Open play");
  expect(
    (
      await db.query("SELECT id FROM group_events WHERE parent_event_id=$1", [
        event,
      ])
    ).rows
  ).toHaveLength(1);
});
it("reports visits once, uses opening hours, and restricts financial reporting", async () => {
  const dates = (await db.query<any>("SELECT now()::date::text AS day"))
    .rows[0];
  const r = (
    await as(owner, "SELECT venue_operating_report($1,$2,$2) data", [
      venue,
      dates.day,
    ])
  )[0].data;
  expect(r.registrations).toBe(2);
  expect(r.no_shows).toBe(0);
  expect(r.unique_players).toBe(2);
  expect(Number(r.available_hours)).toBe(16);
  await expect(
    as(staff, "SELECT venue_operating_report($1,$2,$2)", [venue, dates.day])
  ).rejects.toThrow(/management access/);
  await expect(
    as(owner, "SELECT venue_operating_report($1,'2025-01-01','2026-12-31')", [
      venue,
    ])
  ).rejects.toThrow(/366 days/);
});
