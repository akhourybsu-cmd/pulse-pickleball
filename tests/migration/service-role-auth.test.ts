import { describe, expect, it } from "vitest";
import { isServiceRoleRequest } from "../../supabase/functions/_shared/service-role-auth";

const key = "test-server-credential-not-a-real-secret";
const request = (authorization?: string) => new Request("https://example.test/worker", {
  headers: authorization ? { Authorization: authorization } : {},
});

describe("privileged email worker authorization", () => {
  it("accepts only the exact configured server credential", async () => {
    expect(await isServiceRoleRequest(request(`Bearer ${key}`), key)).toBe(true);
  });
  it("accepts a case-insensitive Bearer scheme", async () => {
    expect(await isServiceRoleRequest(request(`bearer ${key}`), key)).toBe(true);
  });
  it("rejects a different credential of the same length", async () => {
    expect(await isServiceRoleRequest(request(`Bearer ${key.slice(0, -1)}X`), key)).toBe(false);
  });
  it("rejects unsigned tokens that claim the service_role", async () => {
    const forged = `${btoa('{"alg":"none"}')}.${btoa('{"role":"service_role"}')}.`;
    expect(await isServiceRoleRequest(request(`Bearer ${forged}`), key)).toBe(false);
  });
  it("rejects public anon and ordinary user tokens", async () => {
    for (const role of ["anon", "authenticated"]) {
      const token = `header.${btoa(JSON.stringify({ role }))}.signature`;
      expect(await isServiceRoleRequest(request(`Bearer ${token}`), key)).toBe(false);
    }
  });
  it("fails closed for missing credentials or authorization", async () => {
    expect(await isServiceRoleRequest(request(), key)).toBe(false);
    expect(await isServiceRoleRequest(request(`Bearer ${key}`), undefined)).toBe(false);
    expect(await isServiceRoleRequest(request(`Bearer ${key}`), "")).toBe(false);
  });
  it("rejects other schemes and extra token content", async () => {
    for (const value of [`Basic ${key}`, `Bearer ${key} extra`, key]) {
      expect(await isServiceRoleRequest(request(value), key)).toBe(false);
    }
  });
  it("accepts a managed secret API key on the apikey header", async () => {
    const secret = "sb_secret_test_server_only";
    const req = new Request("https://example.test/worker", { headers: { apikey: secret } });
    expect(await isServiceRoleRequest(req, key, JSON.stringify({ default: secret }))).toBe(true);
  });
  it("accepts another named managed secret during rotation", async () => {
    const req = new Request("https://example.test/worker", { headers: { apikey: "sb_secret_rotated" } });
    expect(await isServiceRoleRequest(req, key, JSON.stringify({ default: "sb_secret_old", next: "sb_secret_rotated" }))).toBe(true);
  });
  it("rejects unknown and publishable API keys", async () => {
    for (const apiKey of ["sb_secret_unknown", "sb_publishable_public", "anon"]) {
      const req = new Request("https://example.test/worker", { headers: { apikey: apiKey } });
      expect(await isServiceRoleRequest(req, key, JSON.stringify({ default: "sb_secret_valid" }))).toBe(false);
    }
  });
  it("fails closed for malformed secret-key configuration", async () => {
    const req = new Request("https://example.test/worker", { headers: { apikey: "sb_secret_test" } });
    for (const config of [undefined, "", "not json", "null", '["sb_secret_test"]', '{"default":null}']) {
      expect(await isServiceRoleRequest(req, key, config)).toBe(false);
    }
  });
});
