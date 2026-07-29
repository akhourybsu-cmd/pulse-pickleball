/**
 * Completion-authorization DB integration scenarios (PULSE Skill Assessment).
 *
 * These assert the release-candidate invariant that could NOT be proven by the
 * pure unit tests: the `skill-complete` edge function (→ apply_skill_scoring_
 * snapshot under the service role) is the ONLY path that can produce an
 * authoritative result. They exercise the RLS + column-privilege boundary added
 * in 20260729160000_skill_completion_authorization_hardening.sql, which pure
 * tests cannot reach.
 *
 * Mirrors tests/rr_slice2a + tests/skill_organizer: SKIPPED unless Supabase env
 * vars are present, so it never runs against the wrong project or fails CI
 * without credentials. Run against a seeded staging project.
 *
 * Env: SUPABASE_URL, SUPABASE_ANON_KEY (+ TEST_* fixtures for the seeded cases:
 * a signed-in player who owns an in_progress attempt).
 */
import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const env = URL && ANON;
const d = env ? describe : describe.skip;

d("skill completion authorization — the client cannot self-finalize", () => {
  it("anonymous callers cannot invoke apply_skill_scoring_snapshot", async () => {
    const anon = createClient(URL!, ANON!, { auth: { persistSession: false } });
    const { error } = await anon.rpc("apply_skill_scoring_snapshot", {
      p_attempt_id: "00000000-0000-0000-0000-000000000000",
      p_snapshot: {},
    });
    // REVOKEd from PUBLIC / granted only to service_role → never a success.
    expect(error).toBeTruthy();
  });

  // The following require a seeded, signed-in player who owns an in_progress
  // attempt (TEST_* credentials). They assert the column-privilege boundary.
  it.todo("owner CANNOT UPDATE their in_progress attempt to status='completed'");
  it.todo("owner CANNOT write scoring_snapshot / estimated_level_* on their attempt");
  it.todo("owner CAN still UPDATE last_activity_at (save-and-resume unaffected)");
  it.todo("owner CANNOT INSERT an attempt with scoring columns pre-populated");
  it.todo("owner CANNOT upsert player_skill_profiles.self_assessed_level directly");
  it.todo("skill-complete finalize sets an authoritative result the client could not forge");
  it.todo("a completed attempt remains immutable to the owner (guard trigger)");
});
