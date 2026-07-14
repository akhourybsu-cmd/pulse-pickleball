/**
 * Catalog / security assertions for the Slice 2a RPCs — run directly against
 * Postgres (see db.ts). These verify the hardened security posture that the
 * behavioral suite can't observe through PostgREST. Auto-skips without
 * DATABASE_URL so it never targets a remote by accident.
 *
 * Per the plan, these live in the test suite — NOT in a production migration.
 */
import { describe, it, expect } from "vitest";
import { dbUrl, withDb } from "./db";

const d = dbUrl() ? describe : describe.skip;

const MANAGE_ARGS =
  "uuid, uuid, uuid, text, text, integer, text, boolean, jsonb, jsonb";
const PLAN_ARGS = "uuid, uuid, text, uuid";

async function proc(signature: string) {
  return withDb(async (c) => {
    const { rows } = await c.query(
      `SELECT p.prosecdef,
              pg_get_userbyid(p.proowner) AS owner,
              p.proconfig
         FROM pg_proc p
         JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.oid = ($1)::regprocedure`,
      [`public.${signature}`],
    );
    return rows[0] as { prosecdef: boolean; owner: string; proconfig: string[] | null } | undefined;
  });
}

async function canExecute(signature: string, role: string): Promise<boolean> {
  return withDb(async (c) => {
    const { rows } = await c.query(
      `SELECT has_function_privilege($1, ($2)::regprocedure, 'EXECUTE') AS ok`,
      [role, `public.${signature}`],
    );
    return rows[0]?.ok === true;
  });
}

d("rr_manage_participant — catalog security", () => {
  it("is SECURITY DEFINER, owned by postgres, search_path pinned to pg_catalog", async () => {
    const p = await proc(`rr_manage_participant(${MANAGE_ARGS})`);
    expect(p).toBeTruthy();
    expect(p!.prosecdef).toBe(true);
    expect(p!.owner).toBe("postgres");
    expect(p!.proconfig ?? []).toContain("search_path=pg_catalog");
  });

  it("is executable by authenticated but NOT by anon or PUBLIC", async () => {
    expect(await canExecute(`rr_manage_participant(${MANAGE_ARGS})`, "authenticated")).toBe(true);
    expect(await canExecute(`rr_manage_participant(${MANAGE_ARGS})`, "anon")).toBe(false);
    expect(await canExecute(`rr_manage_participant(${MANAGE_ARGS})`, "public")).toBe(false);
  });
});

d("rr_plan_participant_change — internal planner", () => {
  it("is SECURITY DEFINER with pinned search_path", async () => {
    const p = await proc(`rr_plan_participant_change(${PLAN_ARGS})`);
    expect(p).toBeTruthy();
    expect(p!.prosecdef).toBe(true);
    expect(p!.proconfig ?? []).toContain("search_path=pg_catalog");
  });

  it("is NOT executable by any application role", async () => {
    expect(await canExecute(`rr_plan_participant_change(${PLAN_ARGS})`, "authenticated")).toBe(false);
    expect(await canExecute(`rr_plan_participant_change(${PLAN_ARGS})`, "anon")).toBe(false);
    expect(await canExecute(`rr_plan_participant_change(${PLAN_ARGS})`, "public")).toBe(false);
  });
});

d("round_robin_schedule_counted — exclusion view", () => {
  it("excludes voided, superseded, abandoned, bye, and unscored rows", async () => {
    // The view definition must AND-out non-counting rows. We assert its text
    // references each exclusion so a future edit that drops one is caught.
    const def = await withDb(async (c) => {
      const { rows } = await c.query(
        `SELECT pg_get_viewdef('public.round_robin_schedule_counted'::regclass, true) AS def`,
      );
      return (rows[0]?.def as string) ?? "";
    });
    expect(def).toMatch(/voided_at\s+IS\s+NULL/i);
    expect(def).toMatch(/superseded_by_schedule_id\s+IS\s+NULL/i);
    expect(def).toMatch(/abandoned/i);
    expect(def).toMatch(/is_bye\s*=\s*false/i);
    expect(def).toMatch(/team1_score\s+IS\s+NOT\s+NULL/i);
    expect(def).toMatch(/team2_score\s+IS\s+NOT\s+NULL/i);
  });
});
