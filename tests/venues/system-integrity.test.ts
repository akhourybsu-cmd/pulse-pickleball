import { expect, it } from "vitest";
import {
  venueIntegrityQuery,
  summarizeVenueChecks,
  checkVenueSystem,
  integrityCounters,
} from "../../scripts/check-venue-system.mjs";
import { venueSuiteDatabase } from "../helpers/venueSuiteDatabase";
const venue = "d99d7de3-2431-4ee2-a826-04cc293da1cd";
const valid = () => ({
  venue_exists: true,
  venue_active: true,
  venue_published: true,
  official_community_exists: true,
  community_public: true,
  sample_venue: false,
  required_waiver_published: false,
  products_configured: false,
  coach_availability_configured: false,
  ...Object.fromEntries(integrityCounters.map((k) => [k, 0])),
});
it("separates venue setup and visibility choices from broken data links", () => {
  expect(summarizeVenueChecks(valid())).toMatchObject({
    integrityPassed: true,
    publicAccess: "available",
    setupNeeded: [
      "required_waiver_published",
      "products_configured",
      "coach_availability_configured",
    ],
  });
  expect(
    summarizeVenueChecks({ ...valid(), community_public: false })
  ).toMatchObject({ integrityPassed: true, publicAccess: "restricted" });
  expect(
    summarizeVenueChecks({ ...valid(), overlapping_court_blocks: 1 })
  ).toMatchObject({
    integrityPassed: false,
    failures: ["overlapping_court_blocks"],
  });
  const incomplete = valid();
  delete incomplete.cross_venue_visits;
  expect(summarizeVenueChecks(incomplete).integrityPassed).toBe(false);
});
it("rejects arbitrary SQL and never changes live data", async () => {
  expect(() => venueIntegrityQuery("'; DELETE FROM venues; --")).toThrow(
    /UUID/
  );
  let body: any;
  const result = await checkVenueSystem(
    {
      SUPABASE_PROJECT_REF: "rqfqwavhtfwwtmfjnxkx",
      SUPABASE_ACCESS_TOKEN: "sbp_test",
      VENUE_ID: venue,
    },
    async (_url: any, options: any) => {
      body = JSON.parse(options.body);
      return { ok: true, json: async () => [{ checks: valid() }] };
    }
  );
  expect(body.read_only).toBe(true);
  expect(body.query).not.toMatch(
    /\b(UPDATE|DELETE|INSERT)\s+(INTO|FROM|public\.)/i
  );
  expect(result.integrityPassed).toBe(true);
});
it("redacts provider error bodies", async () => {
  await expect(
    checkVenueSystem(
      {
        SUPABASE_PROJECT_REF: "rqfqwavhtfwwtmfjnxkx",
        SUPABASE_ACCESS_TOKEN: "sbp_test",
        VENUE_ID: venue,
      },
      async () => ({
        ok: false,
        status: 400,
        text: async () => "private customer and token",
      })
    )
  ).rejects.toThrow("Venue integrity query failed (HTTP 400).");
});
it("executes the read-only integrity query against the deployed venue schema", async () => {
  const db = await venueSuiteDatabase();
  try {
    await db.exec(
      "ALTER TABLE venues ADD COLUMN is_published boolean; ALTER TABLE groups ADD COLUMN type text;"
    );
    await db.query("INSERT INTO auth.users VALUES($1)", [venue]);
    await db.query(
      "INSERT INTO venues(id,owner_id,is_active,is_published) VALUES($1,$1,true,true)",
      [venue]
    );
    await db.query(
      "INSERT INTO groups(id,venue_id,type,visibility) VALUES($1,$1,'venue_official','public')",
      [venue]
    );
    const result = await db.query<any>(venueIntegrityQuery(venue));
    expect(summarizeVenueChecks(result.rows[0].checks)).toMatchObject({
      integrityPassed: true,
      publicAccess: "available",
    });
    await db.query("UPDATE groups SET visibility='private' WHERE id=$1", [
      venue,
    ]);
    expect(
      summarizeVenueChecks(
        (await db.query<any>(venueIntegrityQuery(venue))).rows[0].checks
      ).publicAccess
    ).toBe("restricted");
  } finally {
    await db.close();
  }
}, 30000);
