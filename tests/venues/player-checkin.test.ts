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
    "TRUNCATE venues,auth.users,groups,group_events,venue_courts,venue_staff,venue_module_access CASCADE; SELECT set_config('test.mfa_required','',false)"
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
    "INSERT INTO venue_module_access VALUES($1,'facility_tools','existing_venue',true,NULL,now())",
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
async function context() {
  const station = (
    await as(staff, "SELECT * FROM venue_kiosk_create($1,8)", [venue])
  )[0];
  const own = (
    await as(player, "SELECT venue_self_checkin_context($1) data", [
      station.token,
    ])
  )[0].data;
  return { station, own };
}
it("returns only the signed-in player visits and checks them in idempotently", async () => {
  const { own } = await context();
  expect(own.visits.map((v: any) => v.id)).toEqual([rsvp]);
  await as(player, "SELECT venue_self_checkin($1,$2)", [own.visit_token, rsvp]);
  await as(player, "SELECT venue_self_checkin($1,$2)", [own.visit_token, rsvp]);
  const row = (
    await db.query<any>(
      "SELECT checked_in_at,attendance_version FROM group_event_rsvps WHERE id=$1",
      [rsvp]
    )
  ).rows[0];
  expect(row.checked_in_at).toBeTruthy();
  expect(row.attendance_version).toBe(1);
  expect(
    (await db.query("SELECT * FROM venue_self_checkin_intents")).rows
  ).toHaveLength(0);
  expect(
    (await db.query("SELECT * FROM venue_attendance_audit")).rows
  ).toHaveLength(1);
});
it("does not grant arbitrary attendance writes or another player check-in", async () => {
  const { own } = await context();
  await expect(
    as(player, "SELECT venue_self_checkin($1,$2)", [own.visit_token, otherRsvp])
  ).rejects.toThrow(/confirmed event/);
  await expect(
    as(player, "UPDATE group_event_rsvps SET checked_in_at=now() WHERE id=$1", [
      rsvp,
    ])
  ).rejects.toThrow(/Only event managers|attendance access/);
  await expect(
    as(
      player,
      "INSERT INTO venue_self_checkin_intents(rsvp_id,transaction_id,actor_id) VALUES($1,txid_current(),$2)",
      [rsvp, player]
    )
  ).rejects.toThrow(/permission denied/);
});
it("requires the currently published document before either staff or self check-in", async () => {
  const doc = (
    await as(owner, "SELECT * FROM venue_document_publish($1,$2,$3,true)", [
      venue,
      "Venue document",
      "Test fixture wording supplied by a venue.",
    ])
  )[0];
  const { own } = await context();
  await expect(
    as(player, "SELECT venue_self_checkin($1,$2)", [own.visit_token, rsvp])
  ).rejects.toThrow(/required venue documents/);
  await expect(
    as(staff, "SELECT record_venue_attendance($1,$2,'checked_in',0)", [
      event,
      rsvp,
    ])
  ).rejects.toThrow(/required venue documents/);
  await as(player, "SELECT venue_document_accept($1,$2,$3,true)", [
    own.visit_token,
    doc.id,
    "Alex Participant",
  ]);
  await as(player, "SELECT venue_self_checkin($1,$2)", [own.visit_token, rsvp]);
});
it("rejects early check-ins, unverified MFA and expired personal visit links", async () => {
  const { own } = await context();
  await db.query(
    "UPDATE group_events SET start_time=now()+interval '2 hours',end_time=now()+interval '3 hours' WHERE id=$1",
    [event]
  );
  await expect(
    as(player, "SELECT venue_self_checkin($1,$2)", [own.visit_token, rsvp])
  ).rejects.toThrow(/one hour/);
  await db.exec("SELECT set_config('test.mfa_required','unverified',false)");
  await expect(
    as(player, "SELECT venue_self_checkin($1,$2)", [own.visit_token, rsvp])
  ).rejects.toThrow(/verification/);
  await db.exec(
    "SELECT set_config('test.mfa_required','',false); UPDATE venue_visit_links SET expires_at=now()-interval '1 minute'"
  );
  await expect(
    as(player, "SELECT venue_self_checkin($1,$2)", [own.visit_token, rsvp])
  ).rejects.toThrow(/expired/);
});
it("revokes public kiosk access when the station or issuing staff authority is revoked", async () => {
  const { station } = await context();
  const view = (
    await as("", "SELECT venue_kiosk_view($1) data", [station.token], "anon")
  )[0].data;
  expect(view.venue_name).toBe("Venue");
  expect(view.visits).toBeUndefined();
  await as(staff, "SELECT venue_kiosk_manage($1,$2)", [venue, station.id]);
  await expect(
    as("", "SELECT venue_kiosk_view($1)", [station.token], "anon")
  ).rejects.toThrow(/station is closed/);
  const next = (
    await as(staff, "SELECT * FROM venue_kiosk_create($1,8)", [venue])
  )[0];
  await db.exec("UPDATE venue_staff SET is_active=false");
  await expect(
    as("", "SELECT venue_kiosk_view($1)", [next.token], "anon")
  ).rejects.toThrow(/station is closed/);
});

it("closes staff-issued stations when facility access ends", async () => {
  const station=(await as(staff,"SELECT * FROM venue_kiosk_create($1,8)",[venue]))[0];
  await db.query("UPDATE venue_module_access SET enabled=false WHERE venue_id=$1 AND module_key='facility_tools'",[venue]);
  await expect(as("","SELECT venue_kiosk_view($1)",[station.token],"anon")).rejects.toThrow(/station is closed/);
});
