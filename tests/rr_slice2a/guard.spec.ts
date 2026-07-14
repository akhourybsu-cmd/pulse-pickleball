/**
 * Unit tests for the allowlist guard (DB-free, always run). Proves the suite
 * refuses to run against anything but the explicitly-allowlisted disposable
 * project. Uses a temp cwd with its own supabase/config.toml so the assertions
 * don't depend on the real repo's link/config state.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertTestProjectAllowed } from "./guard";

const DISPOSABLE = "abcdefghij0123456789"; // 20-char fake ref
const PROD = "ryxklkayezjnwwunuphn";

let cwd: string;

beforeAll(() => {
  cwd = mkdtempSync(join(tmpdir(), "rr-guard-"));
  mkdirSync(join(cwd, "supabase"), { recursive: true });
  // Repo declares PROD as its project — the guard must never allow it.
  writeFileSync(join(cwd, "supabase", "config.toml"), `project_id = "${PROD}"\n`);
});

afterAll(() => rmSync(cwd, { recursive: true, force: true }));

const base = (over: Record<string, string> = {}) => ({
  RR_TEST_PROJECT_REF: DISPOSABLE,
  SUPABASE_URL: `https://${DISPOSABLE}.supabase.co`,
  ...over,
});

describe("assertTestProjectAllowed", () => {
  it("accepts a well-formed disposable cloud project", () => {
    expect(() => assertTestProjectAllowed(base(), cwd)).not.toThrow();
  });

  it("refuses when RR_TEST_PROJECT_REF is missing", () => {
    expect(() => assertTestProjectAllowed({ SUPABASE_URL: `https://${DISPOSABLE}.supabase.co` }, cwd)).toThrow(/RR_TEST_PROJECT_REF/);
  });

  it("refuses the known production ref", () => {
    expect(() => assertTestProjectAllowed(base({ RR_TEST_PROJECT_REF: PROD, SUPABASE_URL: `https://${PROD}.supabase.co` }), cwd)).toThrow(/production/i);
  });

  it("refuses when SUPABASE_URL ref != RR_TEST_PROJECT_REF", () => {
    expect(() => assertTestProjectAllowed(base({ SUPABASE_URL: "https://zzzzzzzzzzzzzzzzzzzz.supabase.co" }), cwd)).toThrow(/!=|does not/);
  });

  it("refuses a non-HTTPS remote URL", () => {
    expect(() => assertTestProjectAllowed(base({ SUPABASE_URL: `http://${DISPOSABLE}.supabase.co` }), cwd)).toThrow(/HTTPS/);
  });

  it("refuses a DATABASE_URL that references a different project", () => {
    expect(() =>
      assertTestProjectAllowed(base({ DATABASE_URL: "postgresql://postgres:pw@db.zzzzzzzzzzzzzzzzzzzz.supabase.co:5432/postgres" }), cwd),
    ).toThrow(/DATABASE_URL/);
  });

  it("refuses a DATABASE_URL pointing at production", () => {
    expect(() =>
      assertTestProjectAllowed(base({ DATABASE_URL: `postgresql://postgres:pw@db.${PROD}.supabase.co:5432/postgres` }), cwd),
    ).toThrow(/production|DATABASE_URL/);
  });

  it("accepts a matching DATABASE_URL", () => {
    expect(() =>
      assertTestProjectAllowed(base({ DATABASE_URL: `postgresql://postgres:pw@db.${DISPOSABLE}.supabase.co:5432/postgres` }), cwd),
    ).not.toThrow();
  });

  it("accepts a local stack (http + 127.0.0.1) when ref is 'local'", () => {
    expect(() =>
      assertTestProjectAllowed({ RR_TEST_PROJECT_REF: "local", SUPABASE_URL: "http://127.0.0.1:54321" }, cwd),
    ).not.toThrow();
  });

  it("refuses a local URL when ref is not 'local'", () => {
    expect(() =>
      assertTestProjectAllowed({ RR_TEST_PROJECT_REF: DISPOSABLE, SUPABASE_URL: "http://127.0.0.1:54321" }, cwd),
    ).toThrow(/local/);
  });
});
