import { beforeAll, beforeEach, afterAll, it, expect } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { venueSuiteDatabase } from "../helpers/venueSuiteDatabase";
const id = (n: number) =>
  `80000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const owner = id(1),
  player = id(2),
  waiting = id(3),
  next = id(4),
  venue = id(5),
  group = id(6),
  court = id(7),
  event = id(8),
  rsvp = id(9),
  waitRsvp = id(10),
  nextRsvp = id(11);
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
beforeAll(async () => {
  db = await venueSuiteDatabase();
}, 30000);
beforeEach(async () => {
  await db.exec(
    "TRUNCATE venues,auth.users,groups,group_events,venue_courts,venue_staff,venue_module_access CASCADE; TRUNCATE change_notifications; SELECT set_config('test.mfa_required','',false)"
  );
  await db.query("INSERT INTO auth.users VALUES($1),($2),($3),($4)", [
    owner,
    player,
    waiting,
    next,
  ]);
  await db.query(
    "INSERT INTO venues(id,name,owner_id,timezone,is_active) VALUES($1,'Venue',$2,'UTC',true)",
    [venue, owner]
  );
  await db.query("INSERT INTO groups(id,venue_id) VALUES($1,$2)", [
    group,
    venue,
  ]);
  await db.query(
    "INSERT INTO venue_module_access VALUES($1,'facility_tools','existing_venue',true,NULL,now())",
    [venue]
  );
  await db.query(
    "INSERT INTO group_members(group_id,user_id,status) VALUES($1,$2,'active'),($1,$3,'active'),($1,$4,'active')",
    [group, player, waiting, next]
  );
  await db.query(
    "INSERT INTO venue_courts(id,venue_id,name,is_active) VALUES($1,$2,'Court 1',true)",
    [court, venue]
  );
  await db.exec("BEGIN");
  await db.query(
    "INSERT INTO group_events(id,venue_id,group_id,created_by,title,event_format,start_time,end_time,capacity,waitlist_enabled) VALUES($1,$2,$3,$4,'Open play','open_play',now()+interval '2 days',now()+interval '2 days 2 hours',1,true)",
    [event, venue, group, owner]
  );
  await db.query(
    "INSERT INTO group_events(venue_id,group_id,created_by,title,event_format,start_time,end_time,venue_court_id,parent_event_id) SELECT venue_id,group_id,created_by,title,'program_hold',start_time,end_time,$1,id FROM group_events WHERE id=$2",
    [court, event]
  );
  await db.exec("COMMIT");
  await db.query(
    "INSERT INTO venue_automation_settings(venue_id,waitlist_offers) VALUES($1,true)",
    [venue]
  );
  await db.query(
    "INSERT INTO group_event_rsvps(id,event_id,user_id,status,waitlist_position) VALUES($1,$2,$3,'going',NULL),($4,$2,$5,'waitlist',1),($6,$2,$7,'waitlist',2)",
    [rsvp, event, player, waitRsvp, waiting, nextRsvp, next]
  );
});
afterAll(async () => {
  await db?.close();
});
async function release() {
  await as(player, "SELECT set_group_event_rsvp($1,'not_going')", [event]);
}
it("offers the next player a reserved place without confirming them automatically", async () => {
  await release();
  const rows = (await db.query<any>("SELECT * FROM venue_waitlist_offers"))
    .rows;
  expect(rows).toHaveLength(1);
  expect(rows[0].user_id).toBe(waiting);
  expect(rows[0].status).toBe("offered");
  expect(
    (
      await db.query<any>("SELECT status FROM group_event_rsvps WHERE id=$1", [
        waitRsvp,
      ])
    ).rows[0].status
  ).toBe("waitlist");
  await db.query("SELECT venue_process_waitlist($1)", [event]);
  expect(
    (await db.query("SELECT * FROM venue_waitlist_offers")).rows
  ).toHaveLength(1);
  expect(
    (await db.query("SELECT * FROM change_notifications")).rows
  ).toHaveLength(1);
});
it("protects the offered place against another signup and accepts only its recipient", async () => {
  await release();
  const offer = (
    await as(waiting, "SELECT venue_waitlist_offer($1) data", [event])
  )[0].data;
  expect(
    (
      await as(next, "SELECT set_group_event_rsvp($1,'going') status", [event])
    )[0].status
  ).toBe("waitlist");
  await expect(
    as(next, "SELECT venue_waitlist_respond($1,true)", [offer.id])
  ).rejects.toThrow(/no longer available/);
  await as(waiting, "SELECT venue_waitlist_respond($1,true)", [offer.id]);
  expect(
    (await db.query<any>("SELECT status FROM venue_waitlist_offers")).rows[0]
      .status
  ).toBe("accepted");
});
it("moves an expired offer to the next eligible player and never reissues the expired offer", async () => {
  await release();
  await db.exec(
    "UPDATE venue_waitlist_offers SET expires_at=now()-interval '1 minute'"
  );
  await db.query("SELECT venue_process_waitlist($1)", [event]);
  await db.query("SELECT venue_process_waitlist($1)", [event]);
  const rows = (
    await db.query<any>(
      "SELECT user_id,status FROM venue_waitlist_offers ORDER BY created_at,id"
    )
  ).rows;
  expect(rows).toHaveLength(2);
  expect(rows).toContainEqual({ user_id: waiting, status: "expired" });
  expect(rows).toContainEqual({ user_id: next, status: "offered" });
});
it("honors venue notification preferences while retaining the offer in the app", async () => {
  await db.query(
    "INSERT INTO group_notification_prefs(group_id,user_id,muted_all,events) VALUES($1,$2,true,true)",
    [group, waiting]
  );
  await release();
  expect(
    (await db.query("SELECT * FROM venue_waitlist_offers")).rows
  ).toHaveLength(1);
  expect(
    (await db.query("SELECT * FROM change_notifications")).rows
  ).toHaveLength(0);
});
it("offers the next player immediately after a decline and cancels offers when registration pauses", async () => {
  await release();
  const offer = (
    await as(waiting, "SELECT venue_waitlist_offer($1) data", [event])
  )[0].data;
  await as(waiting, "SELECT venue_waitlist_respond($1,false)", [offer.id]);
  expect(
    (
      await db.query<any>(
        "SELECT user_id FROM venue_waitlist_offers WHERE status='offered'"
      )
    ).rows[0].user_id
  ).toBe(next);
  await as(
    owner,
    "UPDATE group_events SET registration_paused=true WHERE id=$1",
    [event]
  );
  expect(
    (
      await db.query<any>(
        "SELECT count(*)::integer n FROM venue_waitlist_offers WHERE status='offered'"
      )
    ).rows[0].n
  ).toBe(0);
});
