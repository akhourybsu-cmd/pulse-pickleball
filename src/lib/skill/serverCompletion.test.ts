import { describe, it, expect } from "vitest";
import { scoreAssessment, type Responses } from "./scoring";
import { QUESTION_BANK_V1 } from "./questionBank";
import { PERSONAS, buildResponses } from "./personas";
import { SELF_ASSESSMENT_CAP } from "./model";
// The server-authoritative completion core (Deno edge fn imports the same file).
import {
  computeAuthoritativeResult,
  MIN_RESPONSES_TO_COMPLETE,
  type StoredResponse,
} from "../../../supabase/functions/_shared/skill/complete.ts";

/** Turn a client Responses map into the DB-shaped rows the server loads. */
function toStored(responses: Responses): StoredResponse[] {
  return Object.entries(responses).map(([item_key, response_key]) => ({ item_key, response_key }));
}

describe("server completion — independence & validation", () => {
  it("valid completion recomputes a snapshot from stored responses", () => {
    const responses = buildResponses(PERSONAS[4]); // intermediate balanced
    const res = computeAuthoritativeResult({ assessmentVersion: 1, responses: toStored(responses) });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.snapshot.estimatedLevelRaw).toBeGreaterThan(1);
      expect(res.snapshot.estimatedLevelRaw).toBeLessThanOrEqual(SELF_ASSESSMENT_CAP);
    }
  });

  it("ignores any client-supplied score — only response_key is honored", () => {
    const responses = buildResponses(PERSONAS[1]); // beginner
    // A malicious client could attach extra fields; the StoredResponse surface
    // has no score channel, and the server recomputes regardless.
    const forged = toStored(responses).map((r) => ({ ...r, response_value: 1, level: 4.7, estimatedLevelRaw: 4.7 }));
    const server = computeAuthoritativeResult({ assessmentVersion: 1, responses: forged as StoredResponse[] });
    const honest = scoreAssessment(QUESTION_BANK_V1, responses);
    expect(server.ok).toBe(true);
    if (server.ok) {
      // Server result equals the honest recompute, NOT the forged 4.7.
      expect(server.snapshot.estimatedLevelRaw).toBeCloseTo(honest.estimatedLevelRaw, 6);
      expect(server.snapshot.estimatedLevelRaw).toBeLessThan(4.7);
    }
  });

  it("rejects an unsupported assessment version", () => {
    const responses = buildResponses(PERSONAS[4]);
    const res = computeAuthoritativeResult({ assessmentVersion: 99, responses: toStored(responses) });
    expect(res.ok).toBe(false);
    expect((res as { code?: string }).code).toBe("unsupported_assessment_version");
  });

  it("rejects an unsupported scoring-model version", () => {
    const responses = buildResponses(PERSONAS[4]);
    const res = computeAuthoritativeResult({ assessmentVersion: 1, scoringModelVersion: 99, responses: toStored(responses) });
    expect(res.ok).toBe(false);
    expect((res as { code?: string }).code).toBe("unsupported_scoring_model_version");
  });

  it("rejects an invalid response key", () => {
    const res = computeAuthoritativeResult({
      assessmentVersion: 1,
      responses: [{ item_key: "sv_legal", response_key: "definitely" }],
    });
    expect(res.ok).toBe(false);
    expect((res as { code?: string }).code).toBe("invalid_response");
  });

  it("rejects a response referencing an unknown/inactive item", () => {
    const responses = toStored(buildResponses(PERSONAS[4]));
    responses.push({ item_key: "ghost_item", response_key: "usually" });
    const res = computeAuthoritativeResult({ assessmentVersion: 1, responses });
    expect(res.ok).toBe(false);
    expect((res as { code?: string }).code).toBe("invalid_question_reference");
  });

  it("rejects too-few responses (missing required answers)", () => {
    const res = computeAuthoritativeResult({
      assessmentVersion: 1,
      responses: [
        { item_key: "sv_legal", response_key: "usually" },
        { item_key: "rt_reliable", response_key: "usually" },
      ],
    });
    expect(res.ok).toBe(false);
    expect((res as { code?: string }).code).toBe("insufficient_responses");
    expect(MIN_RESPONSES_TO_COMPLETE).toBeGreaterThan(2);
  });

  it("handles 'not sure' and contradictions the same way the client engine does", () => {
    const responses = buildResponses(PERSONAS.find((p) => p.key === "inflated_contradictory")!);
    const server = computeAuthoritativeResult({ assessmentVersion: 1, responses: toStored(responses) });
    const client = scoreAssessment(QUESTION_BANK_V1, responses);
    expect(server.ok).toBe(true);
    if (server.ok) {
      expect(server.snapshot.contradictions.length).toBe(client.contradictions.length);
      expect(server.snapshot.meta.notSureCount).toBe(client.meta.notSureCount);
    }
  });

  it("caps the server result at 4.7", () => {
    const all = Object.fromEntries(QUESTION_BANK_V1.map((i) => [i.itemKey, "reliably"])) as Responses;
    const res = computeAuthoritativeResult({ assessmentVersion: 1, responses: toStored(all) });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.snapshot.estimatedLevelRaw).toBeLessThanOrEqual(SELF_ASSESSMENT_CAP);
  });
});

describe("server/client scoring PARITY across every persona", () => {
  it("produces byte-identical authoritative snapshots for all 12 personas", () => {
    for (const p of PERSONAS) {
      const responses = buildResponses(p);
      const client = scoreAssessment(QUESTION_BANK_V1, responses);
      const server = computeAuthoritativeResult({ assessmentVersion: 1, responses: toStored(responses) });
      expect(server.ok, `persona ${p.key} should complete`).toBe(true);
      if (server.ok) {
        // Deep equality — one formula, two entry points.
        expect(server.snapshot, `persona ${p.key} parity`).toEqual(client);
      }
    }
  });
});
