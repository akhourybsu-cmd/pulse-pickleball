import { readFileSync } from "node:fs";
import { beforeAll, beforeEach, afterAll, describe, it, expect } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { venueEventDatabase } from "../helpers/venueEventDatabase";

const id = (n: number) =>
  `30000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const owner = id(1),
  staff = id(2),
  stranger = id(3),
  venue = id(4),
  other = id(5),
  group = id(6);
let db: PGlite;
async function call(
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
async function customer() {
  return (
    await call(
      staff,
      "SELECT c.*,c.updated_at::text updated_at FROM venue_customer_save($1,NULL,NULL,$2,$3,$4,$5) c",
      [venue, "Jamie", "Rivera", "jamie@example.test", "555-0100"]
    )
  )[0];
}
beforeAll(async () => {
  db = await venueEventDatabase();
  await db.exec(
    readFileSync(
      "supabase/migrations/20260929010000_venue_attendance.sql",
      "utf8"
    )
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/20260929100000_venue_customer_records.sql",
      "utf8"
    )
  );
}, 30000);
beforeEach(async () => {
  await db.exec(
    "TRUNCATE venues,auth.users,groups,group_members,venue_staff,venue_module_access CASCADE; SELECT set_config('test.mfa_required','',false)"
  );
  await db.query("INSERT INTO auth.users VALUES($1),($2),($3)", [
    owner,
    staff,
    stranger,
  ]);
  await db.query(
    "INSERT INTO venues(id,name,owner_id) VALUES($1,'Our venue',$2),($3,'Another venue',$4)",
    [venue, owner, other, stranger]
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
});
afterAll(async () => {
  await db?.close();
});

describe("venue-owned player records and documents", () => {
  it("keeps guest records, contacts and notes private to the correct venue staff", async () => {
    const c = await customer();
    await call(staff, "SELECT venue_customer_note($1,$2)", [
      c.id,
      "Prefers a morning session.",
    ]);
    const profile = (
      await call(owner, "SELECT venue_customer_profile($1) data", [c.id])
    )[0].data;
    expect(profile.player.email).toBe("jamie@example.test");
    expect(profile.notes[0].body).toBe("Prefers a morning session.");
    await expect(
      call(stranger, "SELECT venue_customer_profile($1)", [c.id])
    ).rejects.toThrow(/access required/);
    await expect(call(staff, "SELECT * FROM venue_customers")).rejects.toThrow(
      /permission denied/
    );
    await expect(
      call("", "SELECT venue_customer_profile($1)", [c.id], "anon")
    ).rejects.toThrow(/permission denied/);
  });
  it("uses optimistic concurrency and refuses cross-venue edits", async () => {
    const c = await customer();
    await call(staff, "SELECT venue_customer_save($1,$2,$3,$4,$5,NULL,NULL)", [
      venue,
      c.id,
      c.updated_at,
      "J",
      "Rivera",
    ]);
    await expect(
      call(staff, "SELECT venue_customer_save($1,$2,$3,$4,$5,NULL,NULL)", [
        venue,
        c.id,
        c.updated_at,
        "Overwrite",
        "Rivera",
      ])
    ).rejects.toThrow(/changed/);
    await expect(
      call(stranger, "SELECT venue_customer_save($1,$2,$3,$4,$5,NULL,NULL)", [
        other,
        c.id,
        c.updated_at,
        "Steal",
        "Rivera",
      ])
    ).rejects.toThrow(/not found/);
  });
  it("requires management to publish and retains immutable, versioned acceptances", async () => {
    const c = await customer();
    const publish = "SELECT * FROM venue_document_publish($1,$2,$3,true,$4)";
    const wording = "Venue-provided document wording for a test fixture only.";
    await expect(
      call(staff, publish, [venue, "Participation", wording, null])
    ).rejects.toThrow(/management access/);
    const d = (
      await call(owner, publish, [venue, "Participation", wording, null])
    )[0];
    const token = (
      await call(staff, "SELECT venue_visit_link($1) token", [c.id])
    )[0].token;
    const view = (
      await call(
        "",
        "SELECT venue_visit_document_view($1) data",
        [token],
        "anon"
      )
    )[0].data;
    expect(view.player_name).toBe("Jamie R.");
    expect(JSON.stringify(view)).not.toContain("jamie@example.test");
    expect(JSON.stringify(view)).not.toContain("Rivera");
    await expect(
      call(
        "",
        "SELECT venue_document_accept($1,$2,$3,false)",
        [token, d.id, "Jamie Rivera"],
        "anon"
      )
    ).rejects.toThrow(/acknowledge/);
    await call(
      "",
      "SELECT venue_document_accept($1,$2,$3,true)",
      [token, d.id, "Jamie Rivera"],
      "anon"
    );
    await call(
      "",
      "SELECT venue_document_accept($1,$2,$3,true)",
      [token, d.id, "Different name"],
      "anon"
    );
    expect(
      (await db.query<any>("SELECT * FROM venue_document_acceptances")).rows[0]
        .signer_name
    ).toBe("Jamie Rivera");
    const next = (
      await call(owner, publish, [
        venue,
        "Participation updated",
        wording + " Revised.",
        d.id,
      ])
    )[0];
    expect(next.version).toBe(2);
    expect(
      (
        await db.query<any>("SELECT venue_missing_documents($1) missing", [
          c.id,
        ])
      ).rows[0].missing
    ).toBe(1);
    await expect(
      call(
        "",
        "SELECT venue_document_accept($1,$2,$3,true)",
        [token, d.id, "Jamie Rivera"],
        "anon"
      )
    ).rejects.toThrow(/changed/);
  });
  it("revokes old visit links and enforces their expiration and venue scope", async () => {
    const c = await customer();
    const first = (
      await call(owner, "SELECT venue_visit_link($1) token", [c.id])
    )[0].token;
    const second = (
      await call(owner, "SELECT venue_visit_link($1) token", [c.id])
    )[0].token;
    await expect(
      call("", "SELECT venue_visit_document_view($1)", [first], "anon")
    ).rejects.toThrow(/expired/);
    await db.query(
      "UPDATE venue_visit_links SET expires_at=now()-interval '1 second' WHERE token=$1",
      [second]
    );
    await expect(
      call("", "SELECT venue_visit_document_view($1)", [second], "anon")
    ).rejects.toThrow(/expired/);
  });
  it("fails closed for unverified MFA and revoked staff", async () => {
    const c = await customer();
    await db.exec("SELECT set_config('test.mfa_required','unverified',false)");
    await expect(
      call(owner, "SELECT venue_customer_profile($1)", [c.id])
    ).rejects.toThrow(/access required/);
    await db.exec(
      "SELECT set_config('test.mfa_required','',false); UPDATE venue_staff SET is_active=false"
    );
    await expect(
      call(staff, "SELECT venue_customer_directory($1)", [venue])
    ).rejects.toThrow(/access required/);
  });
  it("imports only this venue members and does not duplicate linked player records", async () => {
    await db.query(
      "INSERT INTO group_members(group_id,user_id,status) VALUES($1,$2,'active')",
      [group, staff]
    );
    await call(owner, "SELECT venue_customer_sync($1)", [venue]);
    await call(owner, "SELECT venue_customer_sync($1)", [venue]);
    expect(
      (await db.query<any>("SELECT user_id FROM venue_customers")).rows
    ).toEqual([{ user_id: staff }]);
  });
});
