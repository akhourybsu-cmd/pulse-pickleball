import { describe, expect, it, vi } from "vitest";
import { preparePasswordRecovery } from "../../src/lib/passwordRecovery";

const base = "https://staging.example.test/reset-password";
const session = { user: { id: "recovery-account" } };
function fixture(initialUrl = base) {
  let url = initialUrl;
  const auth = {
    initialize: vi.fn().mockResolvedValue({ error: null }),
    setSession: vi.fn().mockResolvedValue({ data: { session }, error: null }),
    getSession: vi.fn().mockResolvedValue({ data: { session }, error: null }),
  };
  const replaceUrl = vi.fn((path: string) => { url = new URL(path, base).href; });
  return {
    auth, replaceUrl, setUrl: (next: string) => { url = next; },
    run: () => preparePasswordRecovery(auth as unknown as Parameters<typeof preparePasswordRecovery>[0], () => url, replaceUrl),
  };
}

describe("password recovery callback", () => {
  it("installs an admin-generated recovery session before reading any stored session", async () => {
    const test = fixture(`${base}?source=email#type=recovery&access_token=test-access&refresh_token=test-refresh`);
    await test.run();
    expect(test.auth.setSession).toHaveBeenCalledWith({ access_token: "test-access", refresh_token: "test-refresh" });
    expect(test.auth.getSession).not.toHaveBeenCalled();
    expect(test.replaceUrl).toHaveBeenCalledWith("/reset-password?source=email");
  });

  it("also removes recovery credentials supplied in query parameters", async () => {
    const test = fixture(`${base}?type=recovery&access_token=test-access&refresh_token=test-refresh&expires_in=3600`);
    await test.run();
    expect(test.replaceUrl).toHaveBeenCalledWith("/reset-password");
  });

  it.each([
    "#type=recovery&access_token=only-one-token",
    "#type=recovery&refresh_token=only-one-token",
    "#type=magiclink&access_token=test-access&refresh_token=test-refresh",
    "#error=access_denied&error_description=Expired",
    "?error_code=otp_expired",
  ])("rejects incomplete, wrong-type or failed callbacks, even with a prior session: %s", async (suffix) => {
    const test = fixture(`${base}${suffix}`);
    await expect(test.run()).rejects.toThrow("new password reset link");
    expect(test.auth.setSession).not.toHaveBeenCalled();
    expect(test.auth.getSession).not.toHaveBeenCalled();
    expect(test.replaceUrl).toHaveBeenCalledWith("/reset-password");
  });

  it("does not fall back to an existing session if recovery credentials are rejected", async () => {
    const test = fixture(`${base}#type=recovery&access_token=invalid&refresh_token=invalid`);
    test.auth.setSession.mockResolvedValue({ data: { session: null }, error: new Error("Invalid") });
    await expect(test.run()).rejects.toThrow();
    expect(test.auth.getSession).not.toHaveBeenCalled();
    expect(test.replaceUrl).toHaveBeenCalledWith("/reset-password");
  });

  it("waits for the SDK's PKCE exchange instead of exchanging the code twice", async () => {
    const test = fixture(`${base}?code=one-time-code`);
    test.auth.initialize.mockImplementation(async () => {
      test.setUrl(base);
      return { error: null };
    });
    await test.run();
    expect(test.auth.getSession).toHaveBeenCalledOnce();
    expect(test.auth.setSession).not.toHaveBeenCalled();
  });

  it("rejects an unconsumed PKCE code even when another account is already signed in", async () => {
    const test = fixture(`${base}?code=code-from-another-browser`);
    await expect(test.run()).rejects.toThrow();
    expect(test.auth.getSession).not.toHaveBeenCalled();
  });

  it("rejects SDK initialization errors", async () => {
    const test = fixture();
    test.auth.initialize.mockResolvedValue({ error: new Error("Expired") });
    await expect(test.run()).rejects.toThrow();
    expect(test.auth.getSession).not.toHaveBeenCalled();
  });

  it("allows a refresh after a successful reset-link session was established", async () => {
    await expect(fixture().run()).resolves.toBeUndefined();
  });

  it("rejects a reset page with no authenticated session", async () => {
    const test = fixture();
    test.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    await expect(test.run()).rejects.toThrow();
  });
});
