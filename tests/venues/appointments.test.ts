import { readFileSync } from "node:fs";
import { beforeAll, beforeEach, afterAll, it, expect } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { venueSuiteDatabase } from "../helpers/venueSuiteDatabase";
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
  db = await venueSuiteDatabase();
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
async function appointment(
  kind = "private_event",
  overrides: Record<string, unknown> = {}
) {
  const startAt = start.replace("09:30", "12:00"),
    endAt = end.replace("10:30", "13:00");
  if (
    kind === "lesson" &&
    !(await db.query("SELECT id FROM venue_coaches WHERE id=$1", [id(70)])).rows
      .length
  )
    await db.query(
      "INSERT INTO venue_coaches(id,venue_id,name,hourly_rate,availability) VALUES($1,$2,'Coach',80,$3)",
      [
        id(70),
        venue,
        JSON.stringify(
          Array.from({ length: 7 }, (_, weekday) => ({
            weekday,
            start_minute: 480,
            end_minute: 1200,
          }))
        ),
      ]
    );
  const doc = {
    customer_id: customer,
    kind,
    title: "Private booking",
    coach_id: kind === "lesson" ? id(70) : null,
    court_ids: [court],
    start_time: startAt,
    end_time: endAt,
    total_cents: 20000,
    deposit_cents: 5000,
    notes: "Private staff detail",
    tax_inclusive: true,
    ...overrides,
  };
  return (
    await as(
      owner,
      "SELECT * FROM venue_appointment_save($1,NULL,NULL,$2,$3)",
      [
        venue,
        JSON.stringify(doc),
        id(
          80 +
            Number(
              (
                await db.query<any>(
                  "SELECT count(*)::integer n FROM venue_appointments"
                )
              ).rows[0].n
            )
        ),
      ]
    )
  )[0];
}
it("retries a quote once, rejects changed requests and uncollectable small balances", async () => {
  const a = await appointment();
  const retry = () =>
    as(owner, "SELECT * FROM venue_appointment_save($1,NULL,NULL,$2,$3)", [
      venue,
      JSON.stringify(a.request_document),
      a.request_key,
    ]);
  expect((await retry())[0].id).toBe(a.id);
  await expect(
    as(owner, "SELECT venue_appointment_save($1,NULL,NULL,$2,$3)", [
      venue,
      JSON.stringify({ ...a.request_document, title: "Different quote" }),
      a.request_key,
    ])
  ).rejects.toThrow(/request changed/);
  await expect(
    appointment("private_event", { deposit_cents: 25 })
  ).rejects.toThrow(/at least \$0.50/);
  await expect(
    appointment("private_event", { total_cents: 5025, deposit_cents: 5000 })
  ).rejects.toThrow(/at least \$0.50/);
  expect(
    (await db.query("SELECT id FROM venue_appointments")).rows
  ).toHaveLength(1);
});
it("respects existing court reservations and legacy coach lessons", async () => {
  const a = await appointment("lesson");
  await db.query(
    "INSERT INTO venue_bookings(venue_id,court_id,customer_name,start_time,end_time) VALUES($1,$2,'Existing guest',$3,$4)",
    [venue, court, a.start_time, a.end_time]
  );
  await expect(appointment("lesson")).rejects.toThrow(/already has a booking/);
  await db.exec("DELETE FROM venue_bookings");
  await db.query(
    "INSERT INTO venue_courts(id,venue_id,name,is_active) VALUES($1,$2,'Other court',true)",
    [id(61), venue]
  );
  await db.query(
    "INSERT INTO venue_lessons(venue_id,coach_id,court_id,title,start_time,end_time) VALUES($1,$2,$3,'Existing lesson',$4,$5)",
    [venue, id(70), id(61), a.start_time, a.end_time]
  );
  await expect(appointment("lesson")).rejects.toThrow(/already has a booking/);
  await db.exec("UPDATE venue_lessons SET status='cancelled'");
  expect((await appointment("lesson")).status).toBe("draft");
});
it("collects a deposit once, reserves courts, and collects only the remaining balance", async () => {
  await db.query(
    "INSERT INTO venue_courts(id,venue_id,name,is_active,hourly_rate) VALUES($1,$2,'Court 2',true,30)",
    [id(60), venue]
  );
  const a = await appointment("private_event", { court_ids: [court, id(60)] });
  const pay = () =>
    as(
      staff,
      "SELECT * FROM venue_appointment_collect($1,0,'cash',5000,$2,true,true)",
      [a.id, id(90)]
    );
  expect((await pay())[0].status).toBe("paid");
  await pay();
  const confirmed = (
    await db.query<any>("SELECT * FROM venue_appointments WHERE id=$1", [a.id])
  ).rows[0];
  expect(confirmed.status).toBe("confirmed");
  expect(
    (
      await db.query(
        "SELECT id FROM group_events WHERE venue_appointment_id=$1",
        [a.id]
      )
    ).rows
  ).toHaveLength(2);
  await expect(
    as(
      staff,
      "SELECT venue_appointment_collect($1,$2,'cash',20000,$3,true,true)",
      [a.id, confirmed.version, id(91)]
    )
  ).rejects.toThrow(/amount changed/);
  await as(
    staff,
    "SELECT venue_appointment_collect($1,$2,'cash',15000,$3,true,true)",
    [a.id, confirmed.version, id(91)]
  );
  expect(
    (
      await db.query<any>(
        "SELECT sum(amount_cents)::integer n FROM venue_sales WHERE appointment_id=$1",
        [a.id]
      )
    ).rows[0].n
  ).toBe(20000);
  await expect(
    as(staff, "DELETE FROM group_events WHERE venue_appointment_id=$1", [a.id])
  ).rejects.toThrow(/Lessons/);
});
it("locks the coach as well as the court, calculates the lesson price, and respects availability", async () => {
  const a = await appointment("lesson", { total_cents: 1 });
  expect(a.total_cents).toBe(8000);
  await as(
    staff,
    "SELECT venue_appointment_collect($1,0,'cash',8000,$2,true,true)",
    [a.id, id(90)]
  );
  await db.query(
    "INSERT INTO venue_courts(id,venue_id,name,is_active,hourly_rate) VALUES($1,$2,'Court 2',true,30)",
    [id(60), venue]
  );
  await expect(appointment("lesson", { court_ids: [id(60)] })).rejects.toThrow(
    /coach already/
  );
  await expect(
    appointment("lesson", {
      start_time: start.replace("09:30", "21:00"),
      end_time: end.replace("10:30", "22:00"),
    })
  ).rejects.toThrow(/coach is unavailable/);
});
it("uses one lesson from a package and restores it once on cancellation", async () => {
  const p = (
    await as(owner, "SELECT * FROM venue_product_save($1,NULL,NULL,$2)", [
      venue,
      JSON.stringify({
        name: "Three lessons",
        kind: "lesson_pack",
        price_cents: 20000,
        billing_cadence: "one_time",
        units: 3,
        valid_days: 30,
        member_discount_percent: 0,
        stock: null,
        active: true,
        description: "",
        tax_inclusive_acknowledged: true,
      }),
    ])
  )[0];
  await as(staff, "SELECT venue_cash_sale($1,$2,1,20000,$3,true)", [
    customer,
    p.id,
    id(95),
  ]);
  const ent = (await db.query<any>("SELECT id FROM venue_entitlements"))
    .rows[0];
  const a = await appointment("lesson");
  await as(
    staff,
    "SELECT venue_appointment_collect($1,0,'pass',8000,$2,false,true,$3)",
    [a.id, id(90), ent.id]
  );
  expect(
    Number(
      (await db.query<any>("SELECT remaining_units FROM venue_entitlements"))
        .rows[0].remaining_units
    )
  ).toBe(2);
  const ap = (
    await db.query<any>("SELECT * FROM venue_appointments WHERE id=$1", [a.id])
  ).rows[0];
  await as(staff, "SELECT venue_appointment_cancel($1,$2,$3)", [
    a.id,
    ap.version,
    "Customer canceled the lesson",
  ]);
  expect(
    Number(
      (await db.query<any>("SELECT remaining_units FROM venue_entitlements"))
        .rows[0].remaining_units
    )
  ).toBe(3);
  expect(
    (
      await db.query(
        "SELECT id FROM group_events WHERE venue_appointment_id=$1",
        [a.id]
      )
    ).rows
  ).toHaveLength(0);
});
it("keeps quote sharing scoped and private notes off the public link, and blocks forged allocations", async () => {
  const a = await appointment();
  const view = (
    await db.query<any>("SELECT venue_appointment_quote($1) d", [a.quote_token])
  ).rows[0].d;
  expect(view.total_cents).toBe(20000);
  expect(view.notes).toBeUndefined();
  expect(view.customer_id).toBeUndefined();
  await expect(as(player, "SELECT * FROM venue_appointments")).rejects.toThrow(
    /permission denied/
  );
  await expect(
    as(staff, "SELECT venue_appointment_save($1,NULL,NULL,$2,$3)", [
      venue,
      "{}",
      id(99),
    ])
  ).rejects.toThrow(/management access/);
  await expect(
    as(
      owner,
      "INSERT INTO group_events(venue_id,group_id,venue_court_id,venue_appointment_id,created_by,title,start_time,end_time,event_format) SELECT venue_id,group_id,$2,id,created_by,'Forged',start_time,end_time,'reservation' FROM venue_appointments WHERE id=$1",
      [a.id, court]
    )
  ).rejects.toThrow(/permission denied|authorized appointment/);
});
it("tracks physical equipment returns independently of cash refunds and prevents duplicate stock", async () => {
  const p = (
    await as(owner, "SELECT * FROM venue_product_save($1,NULL,NULL,$2)", [
      venue,
      JSON.stringify({
        name: "Paddle rental",
        kind: "equipment_rental",
        price_cents: 500,
        billing_cadence: "one_time",
        units: 1,
        valid_days: 1,
        member_discount_percent: 0,
        stock: 3,
        active: true,
        description: "",
        tax_inclusive_acknowledged: true,
      }),
    ])
  )[0];
  const s = (
    await as(staff, "SELECT * FROM venue_cash_sale($1,$2,2,1000,$3,true)", [
      customer,
      p.id,
      id(96),
    ])
  )[0];
  expect(
    (
      await db.query<any>("SELECT stock FROM venue_products WHERE id=$1", [
        p.id,
      ])
    ).rows[0].stock
  ).toBe(1);
  await as(owner, "SELECT venue_cash_refund($1,1000,$2,$3,true)", [
    s.id,
    "Rental charge returned",
    id(97),
  ]);
  expect(
    (
      await db.query<any>("SELECT stock FROM venue_products WHERE id=$1", [
        p.id,
      ])
    ).rows[0].stock
  ).toBe(1);
  const back = () =>
    as(staff, "SELECT venue_equipment_return($1,1,$2,true)", [s.id, id(98)]);
  await back();
  await back();
  expect(
    (
      await db.query<any>("SELECT stock FROM venue_products WHERE id=$1", [
        p.id,
      ])
    ).rows[0].stock
  ).toBe(2);
  await expect(
    as(staff, "SELECT venue_equipment_return($1,2,$2,true)", [s.id, id(99)])
  ).rejects.toThrow(/physically returned/);
});
it("projects an online court reservation into the player own check-in and preserves cancellation boundaries", async () => {
  await db.exec(
    "UPDATE venue_courts SET hourly_rate=0; UPDATE venues SET hours_of_operation=jsonb_build_object('days',(SELECT jsonb_object_agg(d::text,jsonb_build_object('open','00:00','close','24:00')) FROM generate_series(0,6)d))"
  );
  const booking = (
    await as(
      player,
      "INSERT INTO group_events(venue_id,group_id,venue_court_id,created_by,title,start_time,end_time,event_format,location_type) VALUES($1,$2,$3,$4,'My court',now()+interval '40 minutes',now()+interval '100 minutes','reservation','venue') RETURNING id",
      [venue, group, court, player]
    )
  )[0];
  const ctx = (
    await as(player, "SELECT venue_player_visit_context($1) data", [venue])
  )[0].data;
  expect(ctx.visits).toHaveLength(1);
  const visit = ctx.visits[0];
  await as(player, "SELECT venue_self_checkin($1,NULL,$2)", [
    ctx.visit_token,
    visit.id,
  ]);
  expect(
    (
      await db.query<any>(
        "SELECT status FROM venue_visits WHERE reservation_id=$1",
        [booking.id]
      )
    ).rows[0].status
  ).toBe("checked_in");
  await expect(
    as(
      staff,
      "SELECT venue_visit_status($1,'canceled',1,'Cancel original reservation')",
      [visit.id]
    )
  ).rejects.toThrow(/original booking/);
  await as(player, "DELETE FROM group_events WHERE id=$1", [booking.id]);
  expect(
    (
      await db.query<any>("SELECT status FROM venue_visits WHERE id=$1", [
        visit.id,
      ])
    ).rows[0].status
  ).toBe("canceled");
});
