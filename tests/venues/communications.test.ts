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

it("previews venue-scoped audiences and respects group and global preferences", async () => {
  expect(
    (
      await as(owner, "SELECT venue_message_preview($1,'event',$2) n", [
        venue,
        event,
      ])
    )[0].n
  ).toBe(2);
  await db.query(
    "INSERT INTO notification_preferences VALUES($1,'community',false)",
    [other]
  );
  expect(
    (
      await as(owner, "SELECT venue_message_preview($1,'event',$2) n", [
        venue,
        event,
      ])
    )[0].n
  ).toBe(1);
  await db.query(
    "INSERT INTO group_notification_prefs VALUES($1,$2,true,true)",
    [group, player]
  );
  expect(
    (
      await as(owner, "SELECT venue_message_preview($1,'event',$2) n", [
        venue,
        event,
      ])
    )[0].n
  ).toBe(0);
  await expect(
    as(staff, "SELECT venue_message_preview($1,'community')", [venue])
  ).rejects.toThrow(/management access/);
  await expect(
    as(owner, "SELECT venue_message_preview($1,'event',$2)", [venue, id(99)])
  ).rejects.toThrow(/Choose an event/);
});
it("sends an attributed message once across retries and detects stale audiences", async () => {
  const args = [
    venue,
    event,
    "Arrival update",
    "Please use the north entrance.",
    id(30),
  ];
  await as(
    owner,
    "SELECT * FROM venue_message_send($1,'event',$2,$3,$4,2,$5)",
    args
  );
  await as(
    owner,
    "SELECT * FROM venue_message_send($1,'event',$2,$3,$4,2,$5)",
    args
  );
  expect((await db.query("SELECT * FROM venue_messages")).rows).toHaveLength(1);
  expect(
    (await db.query("SELECT * FROM change_notifications")).rows
  ).toHaveLength(2);
  await expect(
    as(owner, "SELECT venue_message_send($1,'event',$2,$3,$4,1,$5)", [
      ...args.slice(0, 4),
      id(31),
    ])
  ).rejects.toThrow(/Audience changed/);
  await expect(as(player, "SELECT * FROM venue_messages")).rejects.toThrow(
    /permission denied/
  );
});
it("reminds confirmed players once for each event start and respects opt-out", async () => {
  await db.query(
    "INSERT INTO venue_automation_settings(venue_id,event_reminders,reminder_hours,arrival_instructions) VALUES($1,true,24,$2)",
    [venue, "Enter through reception."]
  );
  expect(
    (await db.query<any>("SELECT venue_process_automations() n")).rows[0].n
  ).toBe(2);
  expect(
    (await db.query<any>("SELECT venue_process_automations() n")).rows[0].n
  ).toBe(0);
  await db.query(
    "UPDATE group_events SET start_time=start_time+interval '30 minutes',end_time=end_time+interval '30 minutes' WHERE id=$1",
    [event]
  );
  await db.query(
    "INSERT INTO notification_preferences VALUES($1,'community',false)",
    [other]
  );
  expect(
    (await db.query<any>("SELECT venue_process_automations() n")).rows[0].n
  ).toBe(1);
  await expect(as(owner, "SELECT venue_process_automations()")).rejects.toThrow(
    /permission denied/
  );
});
