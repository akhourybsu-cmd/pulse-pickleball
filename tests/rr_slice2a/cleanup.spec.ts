/**
 * Dedicated fixture-cleanup command (NON-destructive to the project).
 *
 * Deletes ONLY rows this suite creates — events named with the fixture prefix
 * and their child rows. It never resets the database and never touches
 * non-fixture data, so it is safe to run against the disposable project
 * between full runs. Fixtures already self-tear-down per test (afterEach); this
 * is a belt-and-suspenders sweep for any run that aborted mid-flight.
 *
 * Guarded: only acts when RR_CLEANUP=1 (and the allowlist guard in
 * setup.env.ts has already confirmed the target is the disposable project).
 *
 *   RR_CLEANUP=1 npm run test:rr:clean          # bash
 *   $env:RR_CLEANUP=1; npm run test:rr:clean    # PowerShell
 */
import { describe, it, expect } from "vitest";
import { adminClient, readEnv, type HarnessEnv } from "./harness";

const FIXTURE_NAME_PREFIX = "Slice2a fixture ";
const env = readEnv();
const active = env?.adminKey && process.env.RR_CLEANUP === "1";
const d = active ? describe : describe.skip;

d("Slice 2a fixture cleanup", () => {
  it("removes leftover fixture events and their child rows", async () => {
    const admin = adminClient(env as HarnessEnv);
    const { data: events } = await admin
      .from("round_robin_events")
      .select("id, name")
      .like("name", `${FIXTURE_NAME_PREFIX}%`);

    const ids = (events ?? []).map((e: { id: string }) => e.id);
    for (const eventId of ids) {
      await admin.from("round_robin_schedule").delete().eq("event_id", eventId);
      await admin.from("round_robin_audit").delete().eq("event_id", eventId);
      await admin.from("rr_participant_mutation_requests").delete().eq("event_id", eventId);
      await admin.from("round_robin_players").delete().eq("event_id", eventId);
      await admin.from("round_robin_events").delete().eq("id", eventId);
    }

    const { data: remaining } = await admin
      .from("round_robin_events")
      .select("id")
      .like("name", `${FIXTURE_NAME_PREFIX}%`);
    expect((remaining ?? []).length).toBe(0);
  });
});
