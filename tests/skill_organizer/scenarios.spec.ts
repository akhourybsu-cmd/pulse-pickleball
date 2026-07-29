/**
 * Organizer-visibility DB integration scenarios (PULSE Skill Assessment).
 *
 * Mirrors the tests/rr_slice2a pattern: this suite is SKIPPED unless the
 * Supabase env vars are present, so it never runs against the wrong project
 * and never fails CI without credentials. Run it against a seeded staging
 * project to exercise the authorization boundaries that RLS + the
 * SECURITY DEFINER RPCs enforce (which pure unit tests cannot cover).
 *
 * Env: SUPABASE_URL, SUPABASE_ANON_KEY (+ TEST_* fixtures for the seeded
 * cases below).
 */
import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const env = URL && ANON;
const d = env ? describe : describe.skip;

d("skill organizer visibility — authorization at the data layer", () => {
  it("anonymous callers cannot read a player's skill card", async () => {
    const anon = createClient(URL!, ANON!, { auth: { persistSession: false } });
    const { error } = await anon.rpc("get_player_skill_card", {
      p_player_id: "00000000-0000-0000-0000-000000000000",
      p_league_id: null,
    });
    // Unauthenticated → authorization failure (never a silent success).
    expect(error).toBeTruthy();
  });

  it("anonymous callers cannot record an organizer review", async () => {
    const anon = createClient(URL!, ANON!, { auth: { persistSession: false } });
    const { error } = await anon.rpc("record_skill_review", {
      p_player_id: "00000000-0000-0000-0000-000000000000",
      p_league_id: "00000000-0000-0000-0000-000000000000",
      p_review_status: "reviewed",
    });
    expect(error).toBeTruthy();
  });

  // The following require seeded fixtures (two users, a league, a member with a
  // completed assessment). They assert the boundaries described in the plan and
  // should be filled in against staging with TEST_* credentials.
  it.todo("authorized league admin CAN read the member's sanitized card");
  it.todo("card never contains contradictions or meta (raw internals stay private)");
  it.todo("an organizer of a DIFFERENT league is rejected (cross-org)");
  it.todo("the player can read their own card but latest_review_status is null");
  it.todo("the player cannot SELECT skill_organizer_reviews (organizer notes stay private)");
  it.todo("a normal member cannot record a review (is_league_admin required)");
  it.todo("record_skill_review inserts an audit row and never changes self_assessed_level");
});
