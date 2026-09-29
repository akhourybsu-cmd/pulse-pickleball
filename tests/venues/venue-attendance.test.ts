import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { venueEventDatabase } from "../helpers/venueEventDatabase";

const id = (n: number) =>
  `20000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const owner = id(1),
  staff = id(2),
  player = id(3),
  waiting = id(4),
  outsider = id(5),
  venue = id(6),
  group = id(7),
  event = id(8),
  rsvp = id(9),
  waitRsvp = id(10),
  court = id(11);
let db: PGlite;
async function asUser(user: string, sql: string, args: unknown[] = []) {
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [user]);
  await db.exec("SET ROLE authenticated");
  try {
    return await db.query<any>(sql, args);
  } finally {
    await db.exec(
      "RESET ROLE; SELECT set_config('request.jwt.claim.sub','',false)"
    );
  }
}
const mark = (
  status = "checked_in",
  version = 0,
  user = staff,
  attendee = rsvp,
  target = event
) =>
  asUser(user, "SELECT record_venue_attendance($1,$2,$3,$4)", [
    target,
    attendee,
    status,
    version,
  ]);
beforeAll(async () => {
  db = await venueEventDatabase();
  await db.exec(
    readFileSync(
      "supabase/migrations/20260929010000_venue_attendance.sql",
      "utf8"
    )
  );
}, 30000);
beforeEach(async () => {
  await db.exec(
    "TRUNCATE venues,auth.users,groups,group_events,group_members,venue_staff,venue_module_access,venue_courts CASCADE; SELECT set_config('test.mfa_required','',false)"
  );
  await db.query("INSERT INTO auth.users VALUES($1),($2),($3),($4),($5)", [
    owner,
    staff,
    player,
    waiting,
    outsider,
  ]);
  await db.query(
    "INSERT INTO venues(id,name,owner_id,is_active,timezone) VALUES($1,'Venue',$2,true,'America/New_York')",
    [venue, owner]
  );
  await db.query("INSERT INTO groups(id,venue_id) VALUES($1,$2)", [
    group,
    venue,
  ]);
  await db.query(
    "INSERT INTO venue_staff VALUES($1,$2,true,'active','staff')",
    [venue, staff]
  );
  await db.query(
    "INSERT INTO venue_module_access VALUES($1,'facility_tools','existing_venue',true,NULL,now())",
    [venue]
  );
  await db.query(
    "INSERT INTO group_members(group_id,user_id,status) VALUES($1,$2,'active'),($1,$3,'active')",
    [group, player, waiting]
  );
  await db.query(
    "INSERT INTO venue_courts(id,venue_id,name,is_active,court_number) VALUES($1,$2,'Court 1',true,1)",
    [court, venue]
  );
  await db.exec("BEGIN");
  await db.query(
    "INSERT INTO group_events(id,group_id,venue_id,created_by,title,start_time,end_time,event_format,capacity,waitlist_enabled) VALUES($1,$2,$3,$4,'Open play',now()+interval '1 hour',now()+interval '2 hours','open_play',10,true)",
    [event, group, venue, owner]
  );
  await db.query(
    "INSERT INTO group_events(group_id,venue_id,venue_court_id,created_by,title,start_time,end_time,event_format,parent_event_id) SELECT group_id,venue_id,$2,created_by,title,start_time,end_time,'program_hold',id FROM group_events WHERE id=$1",
    [event, court]
  );
  await db.exec("COMMIT");
  await db.query(
    "INSERT INTO group_event_rsvps(id,event_id,user_id,status) VALUES($1,$2,$3,'going'),($4,$2,$5,'waitlist')",
    [rsvp, event, player, waitRsvp, waiting]
  );
});
afterAll(async () => {
  await db?.close();
});
describe("venue attendance authority and consistency", () => {
  it("lets front desk staff record attendance without event or finance management", async () => {
    await mark();
    const rows = (
      await db.query<any>(
        "SELECT checked_in_at,checked_in_by,attendance_version FROM group_event_rsvps WHERE id=$1",
        [rsvp]
      )
    ).rows;
    expect(rows[0].checked_in_at).toBeTruthy();
    expect(rows[0].checked_in_by).toBe(staff);
    expect(rows[0].attendance_version).toBe(1);
    expect(
      (
        await asUser(
          staff,
          "SELECT can_manage_venue_events($1,$2,$3) allowed",
          [staff, venue, group]
        )
      ).rows[0].allowed
    ).toBe(false);
    await expect(
      asUser(staff, "SELECT get_venue_event_attendees($1)", [event])
    ).rejects.toThrow(/access required/);
    expect(
      (await db.query("SELECT * FROM venue_attendance_audit")).rows
    ).toHaveLength(1);
  });
  it("denies members, outsiders, anonymous calls, MFA failures and revoked staff", async () => {
    for (const user of [player, outsider])
      await expect(mark("checked_in", 0, user)).rejects.toThrow(
        /access required/
      );
    await db.exec("SELECT set_config('test.mfa_required','unverified',false)");
    await expect(mark()).rejects.toThrow(/access required/);
    await db.exec(
      "SELECT set_config('test.mfa_required','',false); UPDATE venue_staff SET is_active=false"
    );
    await expect(mark()).rejects.toThrow(/access required/);
    await db.exec("SET ROLE anon");
    try {
      await expect(
        db.query("SELECT get_venue_attendance_day($1,current_date)", [group])
      ).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec("RESET ROLE");
    }
  });
  it("rejects a stale second desk, but retrying the same status is idempotent", async () => {
    await mark();
    await expect(mark("expected", 0)).rejects.toThrow(/another desk/);
    await mark("checked_in", 1);
    expect(
      (await db.query("SELECT * FROM venue_attendance_audit")).rows
    ).toHaveLength(1);
    await mark("expected", 1);
    expect(
      (
        await db.query<any>(
          "SELECT attendance_version,checked_in_at FROM group_event_rsvps WHERE id=$1",
          [rsvp]
        )
      ).rows[0]
    ).toMatchObject({ attendance_version: 2, checked_in_at: null });
  });
  it("rejects waitlisted, mismatched-event and canceled registrations", async () => {
    await expect(mark("checked_in", 0, staff, waitRsvp)).rejects.toThrow(
      /confirmed/
    );
    await expect(mark("checked_in", 0, staff, rsvp, id(888))).rejects.toThrow(
      /access required/
    );
    await db.query(
      "UPDATE group_event_rsvps SET status='not_going' WHERE id=$1",
      [rsvp]
    );
    await expect(mark()).rejects.toThrow(/confirmed/);
  });
  it("records no-shows only after the end, closes the exact roster and permits late corrections", async () => {
    await expect(mark("no_show")).rejects.toThrow(/after the event ends/);
    await db.query(
      "UPDATE group_events SET start_time=now()-interval '2 hours',end_time=now()-interval '1 hour' WHERE id=$1",
      [event]
    );
    await expect(
      asUser(staff, "SELECT close_venue_event_attendance($1,$2)", [event, []])
    ).rejects.toThrow(/another desk/);
    await asUser(staff, "SELECT close_venue_event_attendance($1,$2)", [
      event,
      [rsvp],
    ]);
    await mark("checked_in", 1);
    expect(
      (
        await db.query<any>(
          "SELECT no_show_at,checked_in_at FROM group_event_rsvps WHERE id=$1",
          [rsvp]
        )
      ).rows[0].no_show_at
    ).toBeNull();
    expect(
      (await db.query("SELECT * FROM venue_attendance_audit")).rows
    ).toHaveLength(2);
  });
  it("blocks no-show forgery and attendance version tampering on direct writes", async () => {
    await expect(
      asUser(
        player,
        "UPDATE group_event_rsvps SET no_show_at=now() WHERE id=$1",
        [rsvp]
      )
    ).rejects.toThrow(/access required/);
    await asUser(
      player,
      "UPDATE group_event_rsvps SET attendance_version=999 WHERE id=$1",
      [rsvp]
    );
    expect(
      (
        await db.query<any>(
          "SELECT attendance_version FROM group_event_rsvps WHERE id=$1",
          [rsvp]
        )
      ).rows[0].attendance_version
    ).toBe(0);
  });
  it("clears attendance on cancellation and retains an audit record", async () => {
    await mark();
    const updated = (
      await db.query<any>("SELECT updated_at FROM group_events WHERE id=$1", [
        event,
      ])
    ).rows[0].updated_at;
    await asUser(owner, "SELECT cancel_venue_program($1,$2,$3)", [
      event,
      updated,
      "Weather closure",
    ]);
    const row = (
      await db.query<any>("SELECT * FROM group_event_rsvps WHERE id=$1", [rsvp])
    ).rows[0];
    expect(row.checked_in_at).toBeNull();
    expect(row.no_show_at).toBeNull();
    expect(row.status).toBe("not_going");
    expect(
      (
        await db.query<any>(
          "SELECT status FROM venue_attendance_audit WHERE status='canceled'"
        )
      ).rows
    ).toHaveLength(1);
    await expect(mark()).rejects.toThrow(/active venue event/);
  });
  it("shares attendance and version with legacy event management", async () => {
    await asUser(owner, "SELECT set_venue_event_checkin($1,$2,true)", [
      event,
      rsvp,
    ]);
    const data = (
      await asUser(owner, "SELECT get_venue_event_attendees($1) value", [event])
    ).rows[0].value;
    expect(data.find((x: any) => x.id === rsvp)).toMatchObject({
      name: "Alex S.",
      attendance_version: 1,
      no_show_at: null,
    });
  });
  it("uses venue dates across DST, includes overlapping events once and returns no private profile/payment fields", async () => {
    await db.query(
      "UPDATE group_events SET start_time='2026-11-01T03:30Z',end_time='2026-11-01T05:30Z' WHERE id=$1",
      [event]
    );
    const data = (
      await asUser(
        staff,
        "SELECT get_venue_attendance_day($1,'2026-11-01') value",
        [group]
      )
    ).rows[0].value;
    expect(data.events).toHaveLength(1);
    expect(data.events[0].courts).toEqual(["Court 1"]);
    expect(data.events[0].waitlisted).toBe(1);
    expect(data.events[0].attendees).toHaveLength(1);
    expect(Object.keys(data.events[0].attendees[0]).sort()).toEqual([
      "checked_in_at",
      "id",
      "name",
      "no_show_at",
      "version",
    ]);
    expect(data.events[0].attendees[0].name).toBe("Alex S.");
    await expect(
      asUser(outsider, "SELECT get_venue_attendance_day($1,'2026-11-01')", [
        group,
      ])
    ).rejects.toThrow(/access required/);
  });
});
