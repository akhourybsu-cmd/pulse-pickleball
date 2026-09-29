import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { venueSuiteDatabase } from "../helpers/venueSuiteDatabase";

it("upgrades existing coaches without losing contacts, lesson links, public access or price/status consistency", async () => {
  const owner = "70000000-0000-4000-8000-000000000001";
  const venue = "70000000-0000-4000-8000-000000000002";
  const coach = "70000000-0000-4000-8000-000000000003";
  const court = "70000000-0000-4000-8000-000000000004";
  const db = await venueSuiteDatabase(async (db) => {
    await db.query("INSERT INTO auth.users VALUES($1)", [owner]);
    await db.query(
      "INSERT INTO venues(id,name,owner_id,is_active) VALUES($1,'Existing venue',$2,true)",
      [venue, owner]
    );
    await db.query(
      "INSERT INTO venue_courts(id,venue_id,name,is_active) VALUES($1,$2,'Existing court',true)",
      [court, venue]
    );
    await db.query(
      "INSERT INTO venue_coaches(id,venue_id,name,email,phone,bio,hourly_rate,is_active) VALUES($1,$2,'Existing coach','private@example.test','private phone',NULL,85.25,true)",
      [coach, venue]
    );
    await db.query(
      "INSERT INTO venue_lessons(venue_id,coach_id,court_id,title,start_time,end_time) VALUES($1,$2,$3,'Existing lesson',now()+interval '3 days',now()+interval '3 days 1 hour')",
      [venue, coach, court]
    );
    const sql = readFileSync(
      "supabase/migrations/20260525165811_44216b77-06f5-4567-b695-13606bbd79ae.sql",
      "utf8"
    );
    await db.exec("ALTER TABLE venue_coaches ENABLE ROW LEVEL SECURITY");
    await db.exec(
      sql.match(
        /CREATE OR REPLACE VIEW public\.venue_coaches_public[\s\S]*?GRANT SELECT ON public\.venue_coaches_public TO anon, authenticated;/
      )![0]
    );
    await db.exec(
      sql.match(
        /REVOKE SELECT ON public\.venue_coaches FROM anon;[\s\S]*?USING \(is_active = true\);/
      )![0]
    );
  });
  try {
    const saved = (
      await db.query<any>("SELECT * FROM venue_coaches WHERE id=$1", [coach])
    ).rows[0];
    expect(saved).toMatchObject({
      id: coach,
      email: "private@example.test",
      phone: "private phone",
      bio: null,
      active: true,
      availability: [],
    });
    expect(Number(saved.hourly_cents)).toBe(8525);
    expect(
      (
        await db.query("SELECT coach_id FROM venue_lessons WHERE coach_id=$1", [
          coach,
        ])
      ).rows
    ).toHaveLength(1);
    await db.exec("SET ROLE anon");
    expect(
      (await db.query<any>("SELECT name,hourly_rate FROM venue_coaches_public"))
        .rows[0].name
    ).toBe("Existing coach");
    await expect(db.query("SELECT email FROM venue_coaches")).rejects.toThrow(
      /permission denied/
    );
    await db.exec("RESET ROLE");
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [
      owner,
    ]);
    await db.exec("SET ROLE authenticated");
    const updated = (
      await db.query<any>("SELECT * FROM venue_coach_save($1,$2,$3,$4)", [
        venue,
        coach,
        saved.updated_at,
        JSON.stringify({
          name: "Updated coach",
          bio: "Updated bio",
          hourly_cents: 9750,
          active: false,
          availability: [],
        }),
      ])
    ).rows[0];
    expect(Number(updated.hourly_rate)).toBe(97.5);
    expect(updated.is_active).toBe(false);
    expect(updated.email).toBe("private@example.test");
    await db.exec("RESET ROLE; SET ROLE anon");
    expect(
      (await db.query("SELECT * FROM venue_coaches_public")).rows
    ).toHaveLength(0);
    await db.exec("RESET ROLE");
    await db.query(
      "UPDATE venue_coaches SET hourly_rate=110,is_active=true WHERE id=$1",
      [coach]
    );
    const legacyChange = (
      await db.query<any>(
        "SELECT hourly_cents,active FROM venue_coaches WHERE id=$1",
        [coach]
      )
    ).rows[0];
    expect(Number(legacyChange.hourly_cents)).toBe(11000);
    expect(legacyChange.active).toBe(true);
  } finally {
    await db.close();
  }
}, 30000);
