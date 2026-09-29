import { readFileSync } from "node:fs";
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, beforeEach, afterAll, it, expect } from "vitest";
import { venueEventDatabase } from "../helpers/venueEventDatabase";

const read = (file: string) =>
  readFileSync(`supabase/migrations/${file}`, "utf8");
function readFunction(file: string, name: string) {
  const sql = read(file);
  const start = sql.search(
    new RegExp(
      `CREATE(?: OR REPLACE)? FUNCTION (?:public\\.)?${name}\\s*\\(`,
      "i"
    )
  );
  if (start < 0) throw new Error(`Missing ${name}`);
  const delimiter = sql.slice(start).match(/\bAS\s+(\$\w*\$)/i)![1];
  return sql.slice(
    start,
    sql.indexOf(`${delimiter};`, start) + delimiter.length + 1
  );
}
const id = (n: number) =>
  `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const owner = id(1),
  staff = id(2),
  player = id(3),
  stranger = id(4),
  venue = id(11),
  group = id(12),
  court = id(13),
  secondCourt = id(14);
let db: PGlite;
async function asUser(user: string, sql: string, args: unknown[] = []) {
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [user]);
  await db.exec("SET ROLE authenticated");
  try {
    return (await db.query<any>(sql, args)).rows;
  } finally {
    await db.exec("RESET ROLE");
    await db.exec("SELECT set_config('request.jwt.claim.sub','',false)");
  }
}
beforeAll(async () => {
  db = await venueEventDatabase();
  await db.exec(`
    CREATE TYPE app_role AS ENUM ('admin','player');
    CREATE FUNCTION has_role(uuid,app_role) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
    CREATE FUNCTION update_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
    CREATE TABLE matches(id uuid PRIMARY KEY,round_robin_event_id uuid,source text,voided boolean,voided_at timestamptz,voided_by uuid,void_reason text);
    CREATE FUNCTION recalculate_all_ratings() RETURNS void LANGUAGE sql AS $$ SELECT $$;
    CREATE TABLE round_robin_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text,notes text,organizer_id uuid,venue_id uuid,group_id uuid,group_visibility text,
      location text,date date,start_time time,num_courts integer,num_rounds integer,games_per_player integer,max_players integer,registration_deadline timestamptz,
      registration_mode text,is_published boolean,status text,rating_eligible boolean,rating_type text,format text,allow_guests boolean,
      voided boolean DEFAULT false,voided_at timestamptz,voided_by uuid,void_reason text,current_round integer,schedule_version integer DEFAULT 0);
    CREATE TABLE round_robin_players(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),event_id uuid REFERENCES round_robin_events,player_id uuid,guest_player_id uuid,registration_status text,active boolean DEFAULT true,status text,UNIQUE(event_id,player_id));
    CREATE TABLE round_robin_schedule(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),event_id uuid,match_id uuid,round_no integer,court_no integer,is_bye boolean DEFAULT false,voided_at timestamptz,superseded_by_schedule_id uuid,team1_score integer,team2_score integer,abandoned boolean DEFAULT false);
    CREATE TABLE round_robin_audit(event_id uuid,editor_id uuid,change_type text,changes jsonb,reason text);
    CREATE TABLE rr_schedule_mutation_requests(id uuid);
    CREATE TABLE rr_participant_mutation_requests(id uuid);
    CREATE TABLE guest_players(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),display_name text,created_by uuid,group_id uuid); CREATE UNIQUE INDEX rr_guest_unique ON round_robin_players(event_id,guest_player_id) WHERE guest_player_id IS NOT NULL;
    ALTER TABLE round_robin_events ENABLE ROW LEVEL SECURITY;
    ALTER TABLE round_robin_players ENABLE ROW LEVEL SECURITY;
    ALTER TABLE round_robin_schedule ENABLE ROW LEVEL SECURITY;
    ALTER TABLE round_robin_audit ENABLE ROW LEVEL SECURITY;
    CREATE POLICY legacy_organizer ON round_robin_events FOR ALL TO authenticated USING(organizer_id=auth.uid());
  `);
  await db.exec(read("20260703150000_league_management_foundation.sql"));
  await db.exec(
    readFunction(
      "20260723160559_eeec3125-8f99-430a-9b2e-125c6350fe9d.sql",
      "create_league"
    )
  );
  await db.exec("ALTER TABLE leagues ADD COLUMN invite_code text;");
  for (const name of [
    "rr_apply_schedule_rebuild",
    "rr_edit_schedule",
    "rr_substitute_round",
  ])
    await db.exec(
      readFunction(
        "20260912100000_round_robin_atomic_schedule_rebuild.sql",
        name
      )
    );
  await db.exec(
    readFunction(
      "20260915100000_atomic_round_robin_round_completion.sql",
      "rr_close_round"
    )
  );
  await db.exec(
    readFunction(
      "20260719002414_3d107227-9c70-4d9d-8b58-9c4623b6f5b4.sql",
      "rr_manage_participant"
    )
  );
  await db.exec(
    readFunction(
      "20260709215814_c8952a59-7763-4fcf-8f7c-0f9e7365c9cd.sql",
      "submit_rr_match_score"
    )
  );
  for (const name of ["void_round_robin_event", "delete_round_robin_event"])
    await db.exec(
      readFunction(
        "20260629202559_a7d4c384-324e-47de-9965-c3ed1f33a615.sql",
        name
      )
    );
  await db.exec(
    "GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO authenticated;"
  );
  await db.exec(read("20260928220000_venue_competitions.sql"));
  await db.exec(read("20260929010000_venue_attendance.sql"));
  await db.exec(read("20260928200000_venue_program_roster.sql"));
  await db.exec(
    "CREATE TABLE notification_preferences(user_id uuid,category text,in_app_enabled boolean)"
  );
  await db.exec(read("20260929100000_venue_customer_records.sql"));
  await db.exec(read("20260929110000_venue_desk_sales.sql"));
  await db.exec(read("20260929120000_venue_booking_policies.sql"));
  await db.exec(read("20260929130000_venue_walkins.sql"));
  await db.exec(read("20260929131000_venue_visit_integration.sql"));
  await db.exec(read("20260929140000_venue_player_checkin.sql"));
  await db.exec(read("20260929150000_venue_waitlist_offers.sql"));
  await db.exec(read("20260929160000_venue_communications.sql"));
  await db.exec(read("20260929170000_venue_series_management.sql"));
  await db.exec(read("20260929180000_venue_reports.sql"));
  await db.exec(read("20260929190000_venue_lessons_private_bookings.sql"));
  await db.exec(read("20260929200000_venue_online_booking_attendance.sql"));
  await db.exec(read("20260929210000_venue_desk_completion.sql"));
  await db.exec(read("20260929220000_venue_player_visit_portal.sql"));
  await db.exec(read("20260929230000_venue_desk_competitions.sql"));
}, 30000);
beforeEach(async () => {
  await db.exec(
    "TRUNCATE guest_players,venue_round_robin_links,venue_league_links,group_events,round_robin_players,round_robin_schedule,round_robin_events,round_robin_audit,groups,venues,venue_courts,venue_module_access,venue_staff,group_members,leagues,profiles,auth.users CASCADE;"
  );
  for (const user of [owner, staff, player, stranger, id(5), id(6), id(7)]) {
    await db.query("INSERT INTO auth.users VALUES($1)", [user]);
    await db.query("INSERT INTO profiles(id) VALUES($1)", [user]);
  }
  await db.query(
    "INSERT INTO venues(id,name,owner_id,is_active,timezone) VALUES($1,'Rally Haus',$2,true,'America/New_York')",
    [venue, owner]
  );
  await db.query("INSERT INTO groups(id,venue_id) VALUES($1,$2)", [
    group,
    venue,
  ]);
  await db.query(
    "INSERT INTO venue_staff(venue_id,user_id,is_active,status,role) VALUES($1,$2,true,'active','organizer')",
    [venue, staff]
  );
  await db.query(
    "INSERT INTO venue_module_access(venue_id,module_key,source,enabled) VALUES($1,'facility_tools','existing_venue',true)",
    [venue]
  );
  await db.query(
    "INSERT INTO venue_courts(id,venue_id,name,is_active,court_number) VALUES($1,$3,'Court 2',true,2),($2,$3,'Court 5',true,5)",
    [court, secondCourt, venue]
  );
  for (const user of [player, id(5), id(6), id(7)])
    await db.query(
      "INSERT INTO group_members(group_id,user_id,status) VALUES($1,$2,'active')",
      [group, user]
    );
});
afterAll(async () => {
  await db?.close();
});
async function program() {
  const [e] = await asUser(
    owner,
    "SELECT * FROM create_venue_program($1,$2,$3,$4)",
    [
      group,
      venue,
      JSON.stringify([
        {
          title: "Friday round robin",
          description: "Rotating partners",
          event_format: "round_robin",
          capacity: 8,
          rr_games_per_player: 5,
          start_time: "2099-11-06T23:00:00Z",
          end_time: "2099-11-07T01:00:00Z",
        },
      ]),
      [court, secondCourt],
    ]
  );
  return e.id as string;
}
async function signup(event: string, user = player, status = "going") {
  await asUser(
    user,
    "INSERT INTO group_event_rsvps(event_id,user_id,status) VALUES($1,$2,$3)",
    [event, user, status]
  );
}
async function setup(event: string, user = owner) {
  return (
    await asUser(user, "SELECT setup_venue_round_robin($1) id", [event])
  )[0].id as string;
}
async function prepare(event: string) {
  return asUser(owner, "SELECT prepare_venue_round_robin($1)", [event]);
}

it("copies scheduled details, real courts and only confirmed players, idempotently", async () => {
  const e = await program();
  await signup(e);
  await signup(e, id(5), "maybe");
  const rr = await setup(e);
  expect(await setup(e, staff)).toBe(rr);
  const row = (
    await db.query<any>("SELECT * FROM round_robin_events WHERE id=$1", [rr])
  ).rows[0];
  expect(row).toMatchObject({
    name: "Friday round robin",
    notes: "Rotating partners",
    num_courts: 2,
    games_per_player: 5,
    max_players: 8,
    start_time: "18:00:00",
    venue_id: venue,
    group_id: group,
    rating_eligible: false,
    registration_mode: "immediate",
    is_published: false,
  });
  expect(
    (await db.query("SELECT player_id FROM round_robin_players")).rows
  ).toEqual([{ player_id: player }]);
  const w = (
    await asUser(staff, "SELECT get_venue_competitions($1) w", [group])
  )[0].w;
  expect(w.round_robins[0].courts.map((c: any) => c.name)).toEqual([
    "Court 2",
    "Court 5",
  ]);
  expect(w.round_robins[0].round_robin_id).toBe(rr);
});
it("syncs new signups and withdrawals before preparation without creating placeholder players", async () => {
  const e = await program(),
    rr = await setup(e);
  await signup(e);
  await signup(e, id(5));
  expect(
    (await db.query("SELECT * FROM round_robin_players")).rows
  ).toHaveLength(2);
  await asUser(
    player,
    "UPDATE group_event_rsvps SET status='not_going' WHERE event_id=$1 AND user_id=$2",
    [e, player]
  );
  expect(
    (await db.query("SELECT player_id FROM round_robin_players")).rows
  ).toEqual([{ player_id: id(5) }]);
  await expect(
    asUser(
      owner,
      "INSERT INTO round_robin_players(event_id,player_id,registration_status,active,status) VALUES($1,$2,'confirmed',true,'active')",
      [rr, stranger]
    )
  ).rejects.toThrow("Manage registrations");
  await expect(
    asUser(owner, "DELETE FROM round_robin_players WHERE event_id=$1", [rr])
  ).rejects.toThrow("Manage registrations");
});
it("scopes setup, reads, player mutations and league administration to active venue staff", async () => {
  const e = await program();
  await expect(setup(e, stranger)).rejects.toThrow("access required");
  const rr = await setup(e, staff);
  expect(
    (await asUser(owner, "SELECT can_manage_round_robin($1) allowed", [rr]))[0]
      .allowed
  ).toBe(true);
  await expect(
    asUser(stranger, "SELECT get_venue_competitions($1)", [group])
  ).rejects.toThrow("access required");
  await db.exec("UPDATE venue_staff SET is_active=false");
  expect(
    (await asUser(staff, "SELECT can_manage_round_robin($1) allowed", [rr]))[0]
      .allowed
  ).toBe(false);
  expect(
    await asUser(
      staff,
      "UPDATE round_robin_events SET status='live' WHERE id=$1 RETURNING id",
      [rr]
    )
  ).toEqual([]);
  await expect(
    asUser(owner, "SELECT sync_venue_round_robin($1)", [e])
  ).rejects.toThrow("permission denied");
  await expect(
    asUser(owner, "DELETE FROM venue_round_robin_links")
  ).rejects.toThrow("permission denied");
});
it("requires four players and completed checkouts before closing registration, then freezes courts and roster", async () => {
  const e = await program(),
    rr = await setup(e);
  await expect(prepare(e)).rejects.toThrow("four confirmed");
  for (const user of [player, id(5), id(6), id(7)]) await signup(e, user);
  await db.query(
    "INSERT INTO payment_orders(id,buyer_id,kind,venue_id,group_id,program_event_id,billing_cadence,description,merchant_name,account_id,livemode,amount_cents,request_key) VALUES($1,$2,'event_registration',$3,$4,$5,'one_time','Event registration','Rally Haus','acct_test',true,2000,$1)",
    [id(90), stranger, venue, group, e]
  );
  await expect(prepare(e)).rejects.toThrow("pending checkouts");
  await db.query("UPDATE payment_orders SET status='expired' WHERE id=$1", [
    id(90),
  ]);
  await expect(
    asUser(
      owner,
      "INSERT INTO round_robin_schedule(event_id,round_no,court_no) VALUES($1,1,1)",
      [rr]
    )
  ).rejects.toThrow("Close venue registration");
  await prepare(e);
  await prepare(e);
  expect(
    (
      await db.query<any>(
        "SELECT registration_paused FROM group_events WHERE id=$1",
        [e]
      )
    ).rows[0].registration_paused
  ).toBe(true);
  await asUser(
    owner,
    "INSERT INTO round_robin_schedule(event_id,round_no,court_no) VALUES($1,1,1)",
    [rr]
  );
  await expect(
    asUser(
      owner,
      "UPDATE group_events SET registration_paused=false WHERE id=$1",
      [e]
    )
  ).rejects.toThrow("locked");
  await expect(
    asUser(owner, "DELETE FROM group_events WHERE parent_event_id=$1", [e])
  ).rejects.toThrow("Courts are locked");
  await asUser(
    player,
    "UPDATE group_event_rsvps SET status='not_going' WHERE event_id=$1 AND user_id=$2",
    [e, player]
  );
  expect(
    (await db.query("SELECT * FROM round_robin_players WHERE active")).rows
  ).toHaveLength(4);
  const w = (
    await asUser(owner, "SELECT get_venue_competitions($1) w", [group])
  )[0].w;
  expect(w.round_robins[0].roster_withdrawals).toBe(1);
  await expect(
    asUser(owner, "UPDATE round_robin_events SET status='live' WHERE id=$1", [
      rr,
    ])
  ).rejects.toThrow("withdrawn registrations");
  await asUser(
    staff,
    "UPDATE round_robin_players SET active=false,status='withdrawn' WHERE event_id=$1 AND player_id=$2",
    [rr, player]
  );
  await asUser(
    owner,
    "UPDATE round_robin_events SET status='live' WHERE id=$1",
    [rr]
  );
});
it("imports paid places only after verified payment and never imports a pending checkout", async () => {
  const e = await program();
  await db.query("UPDATE group_events SET price_cents=2000 WHERE id=$1", [e]);
  const rr = await setup(e);
  await expect(signup(e)).rejects.toThrow("secure checkout");
  await db.query(
    "INSERT INTO payment_orders(id,buyer_id,kind,venue_id,group_id,program_event_id,billing_cadence,description,merchant_name,account_id,livemode,amount_cents,request_key) VALUES($1,$2,'event_registration',$3,$4,$5,'one_time','Event registration','Rally Haus','acct_test',true,2000,$1)",
    [id(90), player, venue, group, e]
  );
  expect(
    (
      await db.query("SELECT * FROM round_robin_players WHERE event_id=$1", [
        rr,
      ])
    ).rows
  ).toHaveLength(0);
  await db.query("UPDATE payment_orders SET status='paid' WHERE id=$1", [
    id(90),
  ]);
  await db.query(
    "INSERT INTO group_event_rsvps(event_id,user_id,status,payment_order_id) VALUES($1,$2,'going',$3)",
    [e, player, id(90)]
  );
  expect(
    (
      await db.query(
        "SELECT player_id FROM round_robin_players WHERE event_id=$1",
        [rr]
      )
    ).rows
  ).toEqual([{ player_id: player }]);
});
it("cancels the linked competition with the venue event and releases courts without deleting registration history", async () => {
  const e = await program(),
    rr = await setup(e);
  await signup(e);
  await expect(
    asUser(owner, "SELECT void_round_robin_event($1)", [rr])
  ).rejects.toThrow("Cancel the venue event");
  const row = (
    await db.query<any>("SELECT updated_at FROM group_events WHERE id=$1", [e])
  ).rows[0];
  await asUser(owner, "SELECT cancel_venue_program($1,$2,'Venue closed')", [
    e,
    row.updated_at,
  ]);
  expect(
    (
      await db.query<any>(
        "SELECT status,voided FROM round_robin_events WHERE id=$1",
        [rr]
      )
    ).rows[0]
  ).toEqual({ status: "voided", voided: true });
  expect(
    (
      await db.query("SELECT id FROM group_events WHERE parent_event_id=$1", [
        e,
      ])
    ).rows
  ).toHaveLength(0);
  expect(
    (await db.query("SELECT id FROM group_event_rsvps WHERE event_id=$1", [e]))
      .rows
  ).toHaveLength(1);
});
it("keeps time changes and court counts in sync before play and prevents a second signup path", async () => {
  const e = await program(),
    rr = await setup(e);
  const row = (
    await db.query<any>("SELECT updated_at FROM group_events WHERE id=$1", [e])
  ).rows[0];
  await asUser(owner, "SELECT update_venue_program($1,$2,$3,$4)", [
    e,
    JSON.stringify({
      title: "Saturday round robin",
      start_time: "2099-11-07T23:00:00Z",
      end_time: "2099-11-08T01:00:00Z",
    }),
    [court],
    row.updated_at,
  ]);
  expect(
    (
      await db.query<any>(
        "SELECT name,num_courts FROM round_robin_events WHERE id=$1",
        [rr]
      )
    ).rows[0]
  ).toEqual({ name: "Saturday round robin", num_courts: 1 });
  await expect(
    asUser(
      owner,
      "UPDATE round_robin_events SET is_published=true WHERE id=$1",
      [rr]
    )
  ).rejects.toThrow("venue event management");
  await expect(
    asUser(
      owner,
      "UPDATE round_robin_events SET name='Different' WHERE id=$1",
      [rr]
    )
  ).rejects.toThrow("venue event management");
});
it("creates a real venue league once, honors existing quota, and shares management with current venue staff", async () => {
  const args = [group, "Weekly ladder", "Club ladder", "ladder", id(80)];
  const league = (
    await asUser(owner, "SELECT create_venue_league($1,$2,$3,$4,$5) id", args)
  )[0].id;
  expect(
    (
      await asUser(owner, "SELECT create_venue_league($1,$2,$3,$4,$5) id", args)
    )[0].id
  ).toBe(league);
  expect(
    (await asUser(staff, "SELECT is_league_admin($1) allowed", [league]))[0]
      .allowed
  ).toBe(true);
  expect(
    (await asUser(stranger, "SELECT is_league_admin($1) allowed", [league]))[0]
      .allowed
  ).toBe(false);
  await expect(
    asUser(owner, "SELECT create_venue_league($1,$2,$3,$4,$5)", [
      ...args.slice(0, 4),
      id(81),
    ])
  ).rejects.toThrow("quota");
  await db.exec("UPDATE venue_staff SET is_active=false");
  expect(
    (await asUser(staff, "SELECT is_league_admin($1) allowed", [league]))[0]
      .allowed
  ).toBe(false);
  const w = (
    await asUser(owner, "SELECT get_venue_competitions($1) w", [group])
  )[0].w;
  expect(w.leagues).toHaveLength(1);
  expect(w.leagues[0]).toMatchObject({
    id: league,
    name: "Weekly ladder",
    members: 0,
    seasons: 0,
  });
});
it("cannot attach someone else’s league or move it across venue communities", async () => {
  const league = (
    await asUser(stranger, "SELECT create_league('Private league') id")
  )[0].id;
  await expect(
    asUser(owner, "SELECT link_venue_league($1,$2)", [group, league])
  ).rejects.toThrow("Only the league owner");
  const own = (
    await asUser(owner, "SELECT create_league('My existing league') id")
  )[0].id;
  expect(
    (await asUser(owner, "SELECT link_venue_league($1,$2) id", [group, own]))[0]
      .id
  ).toBe(own);
  await expect(
    db.query("UPDATE leagues SET community_id=null WHERE id=$1", [own])
  ).rejects.toThrow("connected venue");
});
it("applies the required MFA policy to both new tables and denies anonymous RPC calls", async () => {
  const policies = (
    await db.query<any>(
      "SELECT tablename,permissive FROM pg_policies WHERE policyname='pulse_required_mfa' AND tablename IN ('venue_round_robin_links','venue_league_links')"
    )
  ).rows;
  expect(policies).toHaveLength(2);
  expect(policies.every((p) => p.permissive === "RESTRICTIVE")).toBe(true);
  await db.exec("SET ROLE anon");
  try {
    await expect(
      db.query("SELECT get_venue_competitions($1)", [group])
    ).rejects.toThrow("permission denied");
  } finally {
    await db.exec("RESET ROLE");
  }
});

it("records front desk arrivals without rebuilding a linked round robin roster", async () => {
  const e = await program();
  for (const user of [player, id(5), id(6), id(7)]) await signup(e, user);
  const rr = await setup(e);
  await db.query("UPDATE venue_staff SET role='staff' WHERE user_id=$1", [
    staff,
  ]);
  const r = (
    await db.query<any>(
      "SELECT id FROM group_event_rsvps WHERE event_id=$1 AND user_id=$2",
      [e, player]
    )
  ).rows[0];
  const before = (
    await db.query(
      "SELECT * FROM round_robin_players WHERE event_id=$1 ORDER BY id",
      [rr]
    )
  ).rows;
  await asUser(staff, "SELECT record_venue_attendance($1,$2,'checked_in',0)", [
    e,
    r.id,
  ]);
  expect(
    (
      await db.query(
        "SELECT * FROM round_robin_players WHERE event_id=$1 ORDER BY id",
        [rr]
      )
    ).rows
  ).toEqual(before);
  await prepare(e);
  await asUser(staff, "SELECT record_venue_attendance($1,$2,'expected',1)", [
    e,
    r.id,
  ]);
  expect(
    (
      await db.query(
        "SELECT * FROM round_robin_players WHERE event_id=$1 ORDER BY id",
        [rr]
      )
    ).rows
  ).toEqual(before);
});
it("includes real desk guests and linked players in preparation and removes canceled desk entries", async () => {
  const e = await program();
  await signup(e);
  await signup(e, id(5));
  const guest = (
    await asUser(
      owner,
      "SELECT * FROM venue_customer_save($1,NULL,NULL,'Jamie','Surname',NULL,NULL)",
      [venue]
    )
  )[0];
  const linked = (
    await asUser(
      owner,
      "SELECT * FROM venue_customer_save($1,NULL,NULL,'Alex','Player',NULL,NULL)",
      [venue]
    )
  )[0];
  await db.query("UPDATE venue_customers SET user_id=$1 WHERE id=$2", [
    id(6),
    linked.id,
  ]);
  const visit = (
    await asUser(
      owner,
      "SELECT * FROM venue_walkin_book($1,$2,NULL,NULL,NULL,'free',NULL,0,$3)",
      [guest.id, e, id(70)]
    )
  )[0];
  await asUser(
    owner,
    "SELECT venue_walkin_book($1,$2,NULL,NULL,NULL,'free',NULL,0,$3)",
    [linked.id, e, id(71)]
  );
  const rr = await setup(e);
  expect(
    (
      await db.query("SELECT id FROM round_robin_players WHERE event_id=$1", [
        rr,
      ])
    ).rows
  ).toHaveLength(4);
  expect(
    (await db.query<any>("SELECT display_name FROM guest_players")).rows[0]
      .display_name
  ).toBe("Jamie S.");
  expect(
    (await asUser(owner, "SELECT get_venue_competitions($1) w", [group]))[0].w
      .round_robins[0].confirmed
  ).toBe(4);
  await asUser(
    owner,
    "SELECT venue_visit_status($1,'canceled',0,'Guest changed plans')",
    [visit.id]
  );
  expect(
    (
      await db.query("SELECT id FROM round_robin_players WHERE event_id=$1", [
        rr,
      ])
    ).rows
  ).toHaveLength(3);
  await expect(prepare(e)).rejects.toThrow(/four confirmed/);
  await asUser(
    owner,
    "SELECT venue_walkin_book($1,$2,NULL,NULL,NULL,'free',NULL,0,$3)",
    [guest.id, e, id(72)]
  );
  await prepare(e);
  expect(
    (
      await db.query<any>(
        "SELECT roster_locked_at FROM venue_round_robin_links WHERE event_id=$1",
        [e]
      )
    ).rows[0].roster_locked_at
  ).toBeTruthy();
});
