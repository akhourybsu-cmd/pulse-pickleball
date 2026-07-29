/**
 * Completion-authorization DB integration scenarios (PULSE Skill Assessment).
 *
 * These prove the release-candidate invariant that the pure unit tests cannot
 * reach: the `skill-complete` edge function (→ apply_skill_scoring_snapshot
 * under the service role) is the ONLY path that can produce an AUTHORITATIVE
 * result. They exercise the RLS + column-privilege boundary added in
 * 20260729160000_skill_completion_authorization_hardening.sql.
 *
 * SKIPPED unless SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY
 * are set (see tests/skill_shared/harness.ts + tests/README.md). Point them at
 * a DISPOSABLE staging project — never production. The service role is used
 * only for fixture setup/inspection; every security assertion goes through an
 * anon or signed-in client so the real boundary is what's tested.
 *
 * NOTE ON THE HARDENING MIGRATION: scenarios 2, 3, 4 (scoring-column path), and
 * the immutability checks in 6 are EXPECTED TO FAIL before
 * 20260729160000_...sql is applied (that failure IS the reproduced exploit) and
 * to PASS after. Run the suite once before and once after the migration.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import {
  readSkillEnv, SkillHarness, anonClient, invokeComplete,
  validResponses, maxResponses, ACTIVE_ITEM_KEYS,
} from "../skill_shared/harness";

const env = readSkillEnv();
const d = env ? describe : describe.skip;

// A real active item key, so the invalid-response test isolates the
// response_key CHECK constraint (not an unknown item).
const ACTIVE_ITEM_KEY_PLACEHOLDER = ACTIVE_ITEM_KEYS[0] ?? "sv_depth";

const draftCols = (playerId: string, version = 1) => ({
  player_id: playerId, assessment_version: version, assessment_type: "full", status: "in_progress",
});

d("skill completion authorization (staging integration)", () => {
  let h: SkillHarness;
  beforeAll(() => { h = new SkillHarness(env!); });
  afterAll(async () => { await h?.cleanup(); });

  // 1 -----------------------------------------------------------------------
  it("valid player completion produces the full authoritative result", async () => {
    const p = await h.createUser("valid");
    const ins = await p.client.from("skill_assessment_attempts").insert(draftCols(p.id)).select("id").single();
    expect(ins.error, `draft create should succeed: ${ins.error?.message}`).toBeNull();
    const attemptId = (ins.data as { id: string }).id;

    const res = await invokeComplete(p.client, { attemptId, finalResponses: validResponses(28) });
    expect(res.ok, `completion should succeed: ${JSON.stringify(res.body)}`).toBe(true);
    expect(res.body?.authoritative).toBe(true);
    expect(res.body?.idempotent).toBe(false);

    const attempt = await h.getAttempt(attemptId);
    expect(attempt?.status).toBe("completed");
    expect(attempt?.scoring_snapshot, "snapshot persisted").toBeTruthy();
    expect(attempt?.estimated_level_display, "display level persisted").not.toBeNull();
    const profile = await h.getProfile(p.id);
    expect(profile?.self_assessed_level, "profile summary written").not.toBeNull();
    expect(await h.countScores(attemptId), "derived subskill scores written").toBeGreaterThan(0);
    expect(await h.countEvidence(attemptId), "one self_assessment evidence row").toBe(1);
  });

  // 2 -----------------------------------------------------------------------
  it("rejects a direct attempt-forgery (client cannot self-finalize)", async () => {
    const p = await h.createUser("forge-attempt");
    const attemptId = await h.seedDraft(p.id, validResponses(28));

    const forged = await p.client.from("skill_assessment_attempts").update({
      status: "completed",
      estimated_level_raw: 4.7,
      estimated_level_display: 4.5,
      confidence_score: 99,
      scoring_snapshot: { estimatedLevelRaw: 4.7, forged: true },
    }).eq("id", attemptId).select();
    expect(
      forged.error,
      "BOUNDARY VIOLATED: an authenticated player was able to write a forged completion directly to skill_assessment_attempts",
    ).toBeTruthy();

    const after = await h.getAttempt(attemptId);
    expect(after?.status, "attempt must remain in_progress").toBe("in_progress");
    expect(after?.scoring_snapshot, "no forged snapshot stored").toBeNull();
    expect(after?.estimated_level_raw, "no forged level stored").toBeNull();
  });

  // 3 -----------------------------------------------------------------------
  it("rejects a direct profile-forgery (client cannot write self_assessed_*)", async () => {
    const p = await h.createUser("forge-profile");
    const ins = await p.client.from("player_skill_profiles").insert({
      player_id: p.id, self_assessed_level: 4.7, self_assessed_band: "Advanced",
      self_assessment_confidence: 99, provisional_status: false,
    }).select();
    expect(
      ins.error,
      "BOUNDARY VIOLATED: an authenticated player was able to INSERT an authoritative player_skill_profiles row",
    ).toBeTruthy();

    const upd = await p.client.from("player_skill_profiles")
      .update({ self_assessed_level: 4.7 }).eq("player_id", p.id).select();
    expect(
      Boolean(upd.error) || (upd.data?.length ?? 0) === 0,
      "BOUNDARY VIOLATED: an authenticated player was able to UPDATE self_assessed_level",
    ).toBe(true);

    const prof = await h.getProfile(p.id);
    expect(prof?.self_assessed_level ?? null, "no forged self level").toBeNull();
  });

  // 4 -----------------------------------------------------------------------
  it("permits only the draft columns (create + last_activity_at, never scoring)", async () => {
    const p = await h.createUser("permitted");
    const ins = await p.client.from("skill_assessment_attempts").insert(draftCols(p.id)).select("id").single();
    expect(ins.error, "creating an in_progress draft must be allowed").toBeNull();
    const attemptId = (ins.data as { id: string }).id;

    const bump = await p.client.from("skill_assessment_attempts")
      .update({ last_activity_at: new Date().toISOString() }).eq("id", attemptId).select("id");
    expect(bump.error, "updating last_activity_at must be allowed").toBeNull();
    expect(bump.data?.length).toBe(1);

    const scoreWrite = await p.client.from("skill_assessment_attempts")
      .update({ estimated_level_raw: 4.0 }).eq("id", attemptId).select();
    expect(
      scoreWrite.error,
      "BOUNDARY VIOLATED: an authenticated player was able to UPDATE a scoring column",
    ).toBeTruthy();
  });

  // 5 -----------------------------------------------------------------------
  it("rejects cross-player reads, writes, and completion", async () => {
    const a = await h.createUser("cross-a");
    const b = await h.createUser("cross-b");
    const attemptA = await h.seedDraft(a.id, validResponses(28));

    const read = await b.client.from("skill_assessment_responses").select("item_key").eq("attempt_id", attemptA);
    expect(read.error).toBeNull();
    expect(read.data?.length ?? 0, "Player B must not see Player A's raw responses").toBe(0);

    const upd = await b.client.from("skill_assessment_attempts")
      .update({ last_activity_at: new Date().toISOString() }).eq("id", attemptA).select("id");
    expect(upd.data?.length ?? 0, "Player B must not update Player A's attempt").toBe(0);

    const res = await invokeComplete(b.client, { attemptId: attemptA });
    expect(res.ok, "cross-player completion must not succeed").toBe(false);
    expect(res.body?.error, "edge function must forbid another player's attempt").toBe("forbidden");

    const after = await h.getAttempt(attemptA);
    expect(after?.status).toBe("in_progress");
  });

  // 6 -----------------------------------------------------------------------
  it("freezes a completed attempt against the owner", async () => {
    const p = await h.createUser("immutable");
    const ins = await p.client.from("skill_assessment_attempts").insert(draftCols(p.id)).select("id").single();
    const attemptId = (ins.data as { id: string }).id;
    const res = await invokeComplete(p.client, { attemptId, finalResponses: validResponses(28) });
    expect(res.ok, `setup completion should succeed: ${JSON.stringify(res.body)}`).toBe(true);

    const respUpd = await p.client.from("skill_assessment_responses")
      .update({ response_key: "not_yet" }).eq("attempt_id", attemptId).select();
    expect(
      Boolean(respUpd.error) || (respUpd.data?.length ?? 0) === 0,
      "responses must be immutable after completion",
    ).toBe(true);

    const attUpd = await p.client.from("skill_assessment_attempts").update({
      status: "in_progress", estimated_level_raw: 4.7, confidence_score: 1, scoring_snapshot: {},
    }).eq("id", attemptId).select();
    expect(attUpd.error, "a completed attempt must be immutable to its owner").toBeTruthy();

    const scoreUpd = await p.client.from("player_skill_scores")
      .update({ raw_score: 9 }).eq("attempt_id", attemptId).select();
    expect(
      Boolean(scoreUpd.error) || (scoreUpd.data?.length ?? 0) === 0,
      "derived skill scores must be immutable to the player",
    ).toBe(true);

    const after = await h.getAttempt(attemptId);
    expect(after?.status, "still completed with the authoritative result").toBe("completed");
  });

  // 7 -----------------------------------------------------------------------
  it("makes apply_skill_scoring_snapshot effectively service-role-only", async () => {
    const anon = anonClient(env!);
    const anonRes = await anon.rpc("apply_skill_scoring_snapshot" as never, {
      p_attempt_id: randomUUID(), p_snapshot: {},
    } as never);
    expect(anonRes.error, "anonymous callers must be rejected").toBeTruthy();

    const p = await h.createUser("rpc-authed");
    const authRes = await p.client.rpc("apply_skill_scoring_snapshot" as never, {
      p_attempt_id: randomUUID(), p_snapshot: {},
    } as never);
    expect(authRes.error, "authenticated browser clients must be rejected").toBeTruthy();
  });

  // 8 -----------------------------------------------------------------------
  it("is idempotent on retry (no duplicate result / scores / evidence)", async () => {
    const p = await h.createUser("idempotent");
    const attemptId = await h.seedDraft(p.id, validResponses(28));
    const first = await invokeComplete(p.client, { attemptId });
    expect(first.ok, `first completion: ${JSON.stringify(first.body)}`).toBe(true);
    const scores1 = await h.countScores(attemptId);
    const ev1 = await h.countEvidence(attemptId);
    expect(ev1).toBe(1);

    const second = await invokeComplete(p.client, { attemptId });
    expect(second.ok).toBe(true);
    expect(second.body?.idempotent, "second call must be idempotent").toBe(true);
    expect(second.body?.snapshot?.estimatedLevelRaw).toBe(first.body?.snapshot?.estimatedLevelRaw);
    expect(await h.countScores(attemptId), "no duplicate derived scores").toBe(scores1);
    expect(await h.countEvidence(attemptId), "no duplicate evidence rows").toBe(1);
  });

  // 9 -----------------------------------------------------------------------
  it("resolves concurrent completions to exactly one authoritative state", async () => {
    const p = await h.createUser("concurrent");
    const attemptId = await h.seedDraft(p.id, validResponses(28));

    const [r1, r2] = await Promise.all([
      invokeComplete(p.client, { attemptId }),
      invokeComplete(p.client, { attemptId }),
    ]);
    expect(r1.ok && r2.ok, `both calls must resolve safely: ${JSON.stringify(r1.body)} / ${JSON.stringify(r2.body)}`).toBe(true);

    const attempt = await h.getAttempt(attemptId);
    expect(attempt?.status).toBe("completed");
    expect(await h.countEvidence(attemptId), "exactly one authoritative completion").toBe(1);

    const snapCount = r1.body?.snapshot?.subskills?.length ?? r2.body?.snapshot?.subskills?.length ?? 0;
    expect(snapCount).toBeGreaterThan(0);
    expect(await h.countScores(attemptId), "no duplicate derived scores").toBe(snapCount);
    expect(r1.body?.snapshot?.estimatedLevelRaw).toBe(r2.body?.snapshot?.estimatedLevelRaw);
  });

  // 10 ----------------------------------------------------------------------
  it("rejects an unsupported assessment version", async () => {
    const p = await h.createUser("bad-version");
    const ins = await h.service.from("skill_assessment_attempts")
      .insert({ ...draftCols(p.id, 999) }).select("id").single();
    expect(ins.error, `fixture insert: ${ins.error?.message}`).toBeNull();
    const attemptId = (ins.data as { id: string }).id;
    await h.seedResponses(attemptId, validResponses(28));

    const res = await invokeComplete(p.client, { attemptId });
    expect(res.ok).toBe(false);
    expect(res.body?.error).toBe("unsupported_assessment_version");
  });

  it("rejects an unknown/inactive item reference", async () => {
    const p = await h.createUser("bad-item");
    const attemptId = await h.seedDraft(p.id, validResponses(28));
    await h.seedResponses(attemptId, { __not_a_real_item__: "usually" });
    const res = await invokeComplete(p.client, { attemptId });
    expect(res.ok).toBe(false);
    expect(res.body?.error).toBe("invalid_question_reference");
  });

  it("rejects insufficient scored responses (missing required evidence)", async () => {
    const p = await h.createUser("too-few");
    const attemptId = await h.seedDraft(p.id, validResponses(5));
    const res = await invokeComplete(p.client, { attemptId });
    expect(res.ok).toBe(false);
    expect(res.body?.error).toBe("insufficient_responses");
  });

  it("cannot store an out-of-enum response key (invalid-response guard)", async () => {
    const p = await h.createUser("bad-response");
    const attemptId = await h.seedDraft(p.id, validResponses(28));
    // Attempt to write an invalid response_key directly as the owner.
    const bad = await p.client.from("skill_assessment_responses").insert({
      attempt_id: attemptId, item_key: ACTIVE_ITEM_KEY_PLACEHOLDER, response_key: "bogus",
    }).select();
    expect(bad.error, "the DB CHECK constraint must reject an invalid response key").toBeTruthy();
  });


  // 11 ----------------------------------------------------------------------
  it("caps a maximally positive self-assessment at 4.7", async () => {
    const p = await h.createUser("cap");
    const attemptId = await h.seedDraft(p.id, maxResponses());
    const res = await invokeComplete(p.client, { attemptId });
    expect(res.ok, `completion: ${JSON.stringify(res.body)}`).toBe(true);
    expect(res.body?.snapshot?.estimatedLevelRaw ?? 0).toBeLessThanOrEqual(4.7);

    const attempt = await h.getAttempt(attemptId);
    expect(Number(attempt?.estimated_level_raw)).toBeLessThanOrEqual(4.7);
    const profile = await h.getProfile(p.id);
    expect(Number(profile?.self_assessed_level)).toBeLessThanOrEqual(4.7);
  });

  // 12 ----------------------------------------------------------------------
  it("returns the stored result on a post-completion retry (timeout simulation)", async () => {
    const p = await h.createUser("timeout");
    const attemptId = await h.seedDraft(p.id, validResponses(28));
    const first = await invokeComplete(p.client, { attemptId });
    expect(first.ok, `first completion: ${JSON.stringify(first.body)}`).toBe(true);
    const ev1 = await h.countEvidence(attemptId);
    const scores1 = await h.countScores(attemptId);

    // The client "lost" the response after the server committed; it retries.
    const retry = await invokeComplete(p.client, { attemptId });
    expect(retry.ok).toBe(true);
    expect(retry.body?.idempotent).toBe(true);
    expect(retry.body?.snapshot?.estimatedLevelRaw).toBe(first.body?.snapshot?.estimatedLevelRaw);
    expect(await h.countEvidence(attemptId), "no duplicate evidence on retry").toBe(ev1);
    expect(await h.countScores(attemptId), "no duplicate scores on retry").toBe(scores1);
  });
});
