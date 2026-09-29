import { readFileSync } from "node:fs";
import { beforeAll, afterAll, it, expect } from "vitest";
import { venueSuiteDatabase } from "../helpers/venueSuiteDatabase";
import type { PGlite } from "@electric-sql/pglite";
const id = (n: number) =>
  `71000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const owner = id(1),
  player = id(2),
  outsider = id(3),
  venue = id(4),
  group = id(5),
  court = id(6),
  customer = id(7),
  visit = id(8);
let db: PGlite;
async function as(user: string, sql: string, args: unknown[] = []) {
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [user]);
  await db.exec("SET ROLE authenticated");
  try {
    return (await db.query<any>(sql, args)).rows;
  } finally {
    await db.exec(
      "RESET ROLE; SELECT set_config('request.jwt.claim.sub','',false)",
    );
  }
}
beforeAll(async () => {
  db = await venueSuiteDatabase();
  await db.exec(
    "ALTER TABLE group_events ENABLE ROW LEVEL SECURITY; CREATE POLICY fixture_public_read ON group_events FOR SELECT TO authenticated USING(true)",
  );
  await db.query("INSERT INTO auth.users VALUES($1),($2),($3)", [
    owner,
    player,
    outsider,
  ]);
  await db.query(
    "INSERT INTO venues(id,name,owner_id,timezone,is_active) VALUES($1,'Our venue',$2,'UTC',true)",
    [venue, owner],
  );
  await db.query("INSERT INTO groups(id,venue_id) VALUES($1,$2)", [
    group,
    venue,
  ]);
  await db.query(
    "INSERT INTO venue_module_access VALUES($1,'facility_tools','existing_venue',true,NULL,now()),($1,'court_booking','existing_venue',true,NULL,now())",
    [venue],
  );
  await db.query(
    "INSERT INTO venue_courts(id,venue_id,name,is_active) VALUES($1,$2,'Court 1',true)",
    [court, venue],
  );
  await db.query(
    "INSERT INTO venue_customers(id,venue_id,user_id,first_name,last_name) VALUES($1,$2,$3,'Testing','Test')",
    [customer, venue, player],
  );
  await db.query(
    "INSERT INTO venue_visits(id,venue_id,group_id,customer_id,court_id,title,start_time,end_time,status,method,amount_cents,created_by,request_key) VALUES($1,$2,$3,$4,$5,'Private rental',current_date+interval '1 day 10 hours',current_date+interval '1 day 11 hours','expected','free',0,$6,$1)",
    [visit, venue, group, customer, court, owner],
  );
}, 30000);
afterAll(() => db?.close());
it("shows private rentals alongside programs in the same check-in response", async () => {
  const day = (await db.query<any>("SELECT (current_date+1)::text AS day"))
    .rows[0].day;
  const result = (
    await as(owner, "SELECT get_venue_attendance_day($1,$2) data", [group, day])
  )[0].data;
  expect(result.events).toHaveLength(1);
  expect(result.events[0]).toMatchObject({
    title: "Private rental",
    activity_kind: "rental",
    courts: ["Court 1"],
    attendees: [
      { id: visit, customer_id: customer, waiver: { status: "not_required" } },
    ],
  });
  await expect(
    as(outsider, "SELECT get_venue_attendance_day($1,$2)", [group, day]),
  ).rejects.toMatchObject({ code: "42501" });
});
it("clearly distinguishes missing signatures, current signatures and replacement waivers", async () => {
  const doc = (
    await as(
      owner,
      "SELECT * FROM venue_document_publish($1,'Venue waiver','Venue supplied waiver wording for this test.',true,NULL)",
      [venue],
    )
  )[0];
  let data = (
    await as(owner, "SELECT venue_customer_directory($1,$2,0) data", [
      venue,
      "  Testing Test  ",
    ])
  )[0].data;
  expect(data.players[0].waiver).toMatchObject({
    status: "not_signed",
    missing: 1,
  });
  await db.query(
    "INSERT INTO venue_document_acceptances(venue_id,customer_id,document_id,signer_name,user_id) VALUES($1,$2,$3,'Testing Test',$4)",
    [venue, customer, doc.id, player],
  );
  data = (
    await as(owner, "SELECT venue_customer_profile($1) data", [customer])
  )[0].data;
  expect(data.waiver).toMatchObject({ status: "signed", missing: 0 });
  await as(
    owner,
    "SELECT venue_document_publish($1,'Updated waiver','Venue supplied replacement waiver wording.',true,$2)",
    [venue, doc.id],
  );
  data = (
    await as(owner, "SELECT venue_customer_profile($1) data", [customer])
  )[0].data;
  expect(data.waiver).toMatchObject({ status: "update_required", missing: 1 });
});
it("deduplicates prearrival waiver notifications and stops after signing", async () => {
  expect(
    (
      await db.query<any>("SELECT venue_remind_missing_waivers($1) n", [
        customer,
      ])
    ).rows[0].n,
  ).toBe(1);
  expect(
    (
      await db.query<any>("SELECT venue_remind_missing_waivers($1) n", [
        customer,
      ])
    ).rows[0].n,
  ).toBe(0);
  expect(
    (
      await db.query<any>(
        "SELECT venue_remind_missing_waivers($1,'arrival') n",
        [customer],
      )
    ).rows[0].n,
  ).toBe(1);
  await db.query(
    "INSERT INTO venue_document_acceptances(venue_id,customer_id,document_id,signer_name,user_id) SELECT $1,$2,id,'Testing Test',$3 FROM venue_documents WHERE venue_id=$1 AND retired_at IS NULL ON CONFLICT DO NOTHING",
    [venue, customer, player],
  );
  expect(
    (
      await db.query<any>("SELECT venue_remind_missing_waivers($1) n", [
        customer,
      ])
    ).rows[0].n,
  ).toBe(0);
  await expect(
    as(outsider, "SELECT venue_remind_missing_waivers($1)", [customer]),
  ).rejects.toMatchObject({ code: "42501" });
});

it("restricts private party details and permits the renter to add registered players", async () => {
  await expect(
    as(outsider, "SELECT venue_rental_party($1)", [visit]),
  ).rejects.toMatchObject({ code: "42501" });
  await as(player, "SELECT venue_rental_party_add($1,$2)", [visit, outsider]);
  const party = (
    await as(outsider, "SELECT venue_rental_party($1) data", [visit])
  )[0].data;
  expect(party.can_manage).toBe(false);
  expect(party.members).toHaveLength(2);
  expect(party.members.find((x: any) => x.is_you).name).toBe("Alex S.");
  await expect(
    as(outsider, "SELECT venue_rental_party_add($1,$2)", [visit, owner]),
  ).rejects.toMatchObject({ code: "42501" });
  const member = party.members.find((x: any) => x.is_you);
  await as(player, "SELECT venue_rental_party_remove($1,$2)", [
    visit,
    member.id,
  ]);
  await expect(
    as(outsider, "SELECT venue_rental_party($1)", [visit]),
  ).rejects.toMatchObject({ code: "42501" });
});

it("keeps private rental rows hidden but preserves a redacted occupied court block", async () => {
  const reservation = id(30);
  await db.query("INSERT INTO group_members VALUES($1,$2,'active','member')", [
    group,
    player,
  ]);
  await db.query(
    "INSERT INTO group_events(id,venue_id,group_id,venue_court_id,created_by,title,description,event_format,start_time,end_time) VALUES($1,$2,$3,$4,$5,'Private birthday','Secret party notes','reservation',current_date+interval '2 days 12 hours',current_date+interval '2 days 13 hours')",
    [reservation, venue, group, court, player],
  );
  expect(
    await as(
      outsider,
      "SELECT id,title,description FROM group_events WHERE id=$1",
      [reservation],
    ),
  ).toEqual([]);
  expect(
    await as(player, "SELECT title FROM group_events WHERE id=$1", [
      reservation,
    ]),
  ).toEqual([{ title: "Private birthday" }]);
  const calendar = (
    await as(
      outsider,
      "SELECT venue_calendar_sessions($1,current_date+2,current_date+3) data",
      [venue],
    )
  )[0].data;
  expect(calendar.find((x: any) => x.id === reservation)).toMatchObject({
    title: "Private booking",
    description: null,
    created_by: null,
    private_booking: true,
    venue_court_id: court,
  });
  await as(player, "SELECT venue_rental_party_add($1,$2)", [
    reservation,
    outsider,
  ]);
  expect(
    await as(outsider, "SELECT title FROM group_events WHERE id=$1", [
      reservation,
    ]),
  ).toEqual([{ title: "Private birthday" }]);
  const rentals = (
    await as(outsider, "SELECT venue_my_rental_parties($1) data", [venue])
  )[0].data;
  expect(rentals.some((x: any) => x.title === "Private birthday")).toBe(true);
  const day = (await db.query<any>("SELECT (current_date+2)::text AS day"))
    .rows[0].day;
  const arrivals = (
    await as(owner, "SELECT get_venue_attendance_day($1,$2) data", [group, day])
  )[0].data;
  expect(
    arrivals.events.find((e: any) => e.id === reservation).attendees,
  ).toHaveLength(2);
  await db.query(
    "UPDATE group_events SET start_time=start_time+interval '1 hour',end_time=end_time+interval '1 hour' WHERE id=$1",
    [reservation],
  );
  const times = (
    await db.query<any>(
      "SELECT count(DISTINCT start_time)::integer n FROM venue_visits WHERE reservation_id=$1",
      [reservation],
    )
  ).rows[0].n;
  expect(times).toBe(1);
  await db.query("DELETE FROM group_events WHERE id=$1", [reservation]);
  expect(
    (
      await db.query<any>(
        "SELECT count(*)::integer n FROM venue_visits WHERE title='Private birthday' AND status<>'canceled'",
      )
    ).rows[0].n,
  ).toBe(0);
});
it("requires every rental party member to sign their own waiver before check-in", async () => {
  await as(player, "SELECT venue_rental_party_add($1,$2)", [visit, outsider]);
  const party = (
    await as(player, "SELECT venue_rental_party($1) data", [visit])
  )[0].data;
  const member = party.members.find((m: any) => !m.lead);
  const row = (
    await db.query<any>("SELECT * FROM venue_visits WHERE id=$1", [member.id])
  ).rows[0];
  await expect(
    as(owner, "SELECT venue_visit_status($1,'checked_in',$2)", [
      row.id,
      row.version,
    ]),
  ).rejects.toThrow(/documents/);
  await db.query(
    "INSERT INTO venue_document_acceptances(venue_id,customer_id,document_id,signer_name,user_id) SELECT $1,$2,id,'Alex Surname',$3 FROM venue_documents WHERE venue_id=$1 AND retired_at IS NULL",
    [venue, row.customer_id, outsider],
  );
  await as(owner, "SELECT venue_visit_status($1,'checked_in',$2)", [
    row.id,
    row.version,
  ]);
  expect(
    (
      await db.query<any>("SELECT status FROM venue_visits WHERE id=$1", [
        row.id,
      ])
    ).rows[0].status,
  ).toBe("checked_in");
});
const windows = Array.from({ length: 7 }, (_, weekday) => ({
  weekday,
  start_minute: 480,
  end_minute: 1200,
}));
it("saves coach details and previews coach time off independently of court availability", async () => {
  const coach = (
    await as(owner, "SELECT * FROM venue_coach_save($1,NULL,NULL,$2)", [
      venue,
      JSON.stringify({
        name: "Coach Alex",
        bio: "Doubles specialist",
        hourly_cents: 0,
        active: true,
        availability: windows,
        user_id: outsider,
        email: "coach@example.test",
        phone: "555-0100",
        specialties: ["Doubles"],
        time_off: [],
      }),
    ])
  )[0];
  expect(coach).toMatchObject({ user_id: outsider, specialties: ["Doubles"] });
  let preview = (
    await as(
      owner,
      "SELECT venue_lesson_availability($1,$2,current_date+interval '3 days 10 hours',current_date+interval '3 days 11 hours') data",
      [venue, coach.id],
    )
  )[0].data;
  expect(preview).toMatchObject({
    available: true,
    courts: [{ id: court, available: true }],
  });
  const dates = (
    await db.query<any>(
      "SELECT (current_date+interval '3 days 10 hours')::timestamptz AS start_time,(current_date+interval '3 days 11 hours')::timestamptz AS end_time",
    )
  ).rows[0];
  await as(owner, "SELECT venue_coach_save($1,$2,$3,$4)", [
    venue,
    coach.id,
    coach.updated_at,
    JSON.stringify({
      name: "Coach Alex",
      bio: "",
      hourly_cents: 0,
      active: true,
      availability: windows,
      user_id: outsider,
      time_off: [dates],
    }),
  ]);
  preview = (
    await as(
      owner,
      "SELECT venue_lesson_availability($1,$2,current_date+interval '3 days 10 hours',current_date+interval '3 days 11 hours') data",
      [venue, coach.id],
    )
  )[0].data;
  expect(preview.available).toBe(false);
  expect(preview.reason).toMatch(/time off/);
  expect(preview.courts[0].available).toBe(true);
  await expect(
    as(
      player,
      "SELECT venue_lesson_availability($1,$2,now(),now()+interval '1 hour')",
      [venue, coach.id],
    ),
  ).rejects.toMatchObject({ code: "42501" });
  const own = (
    await as(
      outsider,
      "SELECT venue_my_coach_schedule($1,current_date,current_date+7) data",
      [venue],
    )
  )[0].data;
  expect(own.coaches).toHaveLength(1);
  const other = (
    await as(
      player,
      "SELECT venue_my_coach_schedule($1,current_date,current_date+7) data",
      [venue],
    )
  )[0].data;
  expect(other.coaches).toEqual([]);
});
it("checks cross-venue coaching conflicts and both old and new lesson calendars", async () => {
  const coach = (
    await db.query<any>("SELECT * FROM venue_coaches WHERE venue_id=$1", [
      venue,
    ])
  ).rows[0];
  const secondVenue = id(50),
    secondCourt = id(51),
    secondCoach = id(52);
  await db.query(
    "INSERT INTO venues(id,name,owner_id,timezone,is_active) VALUES($1,'Other venue',$2,'UTC',true)",
    [secondVenue, owner],
  );
  await db.query(
    "INSERT INTO venue_courts(id,venue_id,name,is_active) VALUES($1,$2,'Other court',true)",
    [secondCourt, secondVenue],
  );
  await db.query(
    "INSERT INTO venue_coaches(id,venue_id,name,user_id,availability) VALUES($1,$2,'Same coach',$3,$4)",
    [secondCoach, secondVenue, outsider, JSON.stringify(windows)],
  );
  await db.query(
    "INSERT INTO venue_lessons(id,venue_id,coach_id,court_id,title,start_time,end_time) VALUES($1,$2,$3,$4,'Existing lesson',current_date+interval '4 days 10 hours',current_date+interval '4 days 11 hours')",
    [id(53), secondVenue, secondCoach, secondCourt],
  );
  const preview = (
    await as(
      owner,
      "SELECT venue_lesson_availability($1,$2,current_date+interval '4 days 10 hours',current_date+interval '4 days 11 hours') data",
      [venue, coach.id],
    )
  )[0].data;
  expect(preview.available).toBe(false);
  expect(preview.reason).toMatch(/already has a lesson/);
  await expect(
    db.query(
      "INSERT INTO venue_lessons(venue_id,coach_id,court_id,title,start_time,end_time) VALUES($1,$2,$3,'Conflict',current_date+interval '4 days 10 hours',current_date+interval '4 days 11 hours')",
      [venue, coach.id, court],
    ),
  ).rejects.toMatchObject({ code: "23P01" });
  const dates = (
    await db.query<any>(
      "SELECT (current_date+interval '4 days 10 hours')::timestamptz AS start_time,(current_date+interval '4 days 11 hours')::timestamptz AS end_time",
    )
  ).rows[0];
  await expect(
    as(owner, "SELECT venue_appointment_save($1,NULL,NULL,$2,$3)", [
      venue,
      JSON.stringify({
        kind: "lesson",
        title: "Conflicting lesson",
        customer_id: customer,
        coach_id: coach.id,
        court_ids: [court],
        ...dates,
        total_cents: 0,
        deposit_cents: 0,
      }),
      id(55),
    ]),
  ).rejects.toMatchObject({ code: "23P01" });
  await db.query(
    "INSERT INTO venue_lessons(venue_id,coach_id,court_id,title,start_time,end_time) VALUES($1,$2,$3,'Adjacent lesson',current_date+interval '4 days 11 hours',current_date+interval '4 days 12 hours')",
    [venue, coach.id, court],
  );
  const busyCourt = (
    await as(
      owner,
      "SELECT venue_lesson_availability($1,NULL,current_date+interval '4 days 11 hours',current_date+interval '4 days 12 hours') data",
      [venue],
    )
  )[0].data;
  expect(busyCourt.courts[0].available).toBe(false);
});

it("groups a private appointment party into one kiosk activity and cancels the full party with its booking", async () => {
  const dates = (
    await db.query<any>(
      "SELECT (current_date+interval '5 days 10 hours')::timestamptz start_time,(current_date+interval '5 days 11 hours')::timestamptz end_time",
    )
  ).rows[0];
  const a = (
    await as(
      owner,
      "SELECT * FROM venue_appointment_save($1,NULL,NULL,$2,$3)",
      [
        venue,
        JSON.stringify({
          kind: "private_event",
          title: "Private group lesson space",
          customer_id: customer,
          court_ids: [court],
          ...dates,
          total_cents: 0,
          deposit_cents: 0,
        }),
        id(60),
      ],
    )
  )[0];
  await as(
    owner,
    "SELECT venue_appointment_collect($1,0,'free',0,$2,false,true)",
    [a.id, id(61)],
  );
  await as(player, "SELECT venue_rental_party_add($1,$2)", [a.id, outsider]);
  const day = (await db.query<any>("SELECT (current_date+5)::text AS day"))
    .rows[0].day;
  const arrivals = (
    await as(owner, "SELECT get_venue_attendance_day($1,$2) data", [group, day])
  )[0].data;
  expect(arrivals.events.find((e: any) => e.id === a.id)).toMatchObject({
    activity_kind: "rental",
    event_format: "private_event",
  });
  expect(
    arrivals.events.find((e: any) => e.id === a.id).attendees,
  ).toHaveLength(2);
  const current = (
    await db.query<any>("SELECT version FROM venue_appointments WHERE id=$1", [
      a.id,
    ])
  ).rows[0];
  await as(
    owner,
    "SELECT venue_appointment_cancel($1,$2,'Customer requested cancellation')",
    [a.id, current.version],
  );
  expect(
    (
      await db.query<any>(
        "SELECT count(*)::integer n FROM venue_visits WHERE appointment_id=$1 AND status<>'canceled'",
        [a.id],
      )
    ).rows[0].n,
  ).toBe(0);
});
it("closes rental attendance with optimistic checks and an audit trail, leaving paid-pending players untouched", async () => {
  const ended = id(65),
    unpaid = id(66);
  for (const [key, status] of [
    [ended, "expected"],
    [unpaid, "pending_payment"],
  ])
    await db.query(
      "INSERT INTO venue_visits(id,venue_id,group_id,customer_id,court_id,title,start_time,end_time,status,method,amount_cents,created_by,request_key) VALUES($1,$2,$3,$4,$5,'Yesterday rental',current_date-interval '1 day 3 hours',current_date-interval '1 day 2 hours',$6,'free',0,$7,$1)",
      [key, venue, group, customer, court, status, owner],
    );
  await expect(
    as(owner, "SELECT close_venue_arrival_attendance($1,$2,$3)", [
      venue,
      ended,
      [unpaid],
    ]),
  ).rejects.toMatchObject({ code: "40001" });
  expect(
    (
      await as(owner, "SELECT close_venue_arrival_attendance($1,$2,$3) n", [
        venue,
        ended,
        [ended],
      ])
    )[0].n,
  ).toBe(1);
  expect(
    (
      await db.query<any>("SELECT status FROM venue_visits WHERE id=$1", [
        unpaid,
      ])
    ).rows[0].status,
  ).toBe("pending_payment");
  expect(
    (
      await db.query<any>(
        "SELECT status FROM venue_visit_audit WHERE visit_id=$1",
        [ended],
      )
    ).rows.some((r: any) => r.status === "no_show"),
  ).toBe(true);
});
