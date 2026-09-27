import React, { useEffect, useState } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  subscribe: vi.fn(),
  from: vi.fn(),
  security: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getSession: mocks.getSession, onAuthStateChange: mocks.subscribe },
    from: mocks.from,
  },
}));
vi.mock("@/lib/mfa", () => ({
  getMfaStatus: mocks.security,
  MFA_VERIFIED_EVENT: "pulse:mfa-verified",
}));
import { AuthStateProvider, useAuthState } from "../../src/hooks/useAuthState";
import { AuthGuard } from "../../src/components/guards/AuthGuard";

let renderer: ReactTestRenderer;
let session: Session | null;
let listener: (event: AuthChangeEvent, session: Session | null) => void;
let mounts: number;
let hydrations: number;
const account = (id: string) => ({ user: { id } } as Session);
const verified = (id = "player-a") => ({
  userId: id,
  sessionId: "session",
  method: "none",
  verified: true,
});

function DraftForm() {
  const auth = useAuthState();
  const [draft, setDraft] = useState("");
  useEffect(() => {
    mounts++;
  }, []);
  useEffect(() => {
    hydrations++;
    setDraft(auth.profile?.full_name ?? "");
  }, [auth.user, auth.profile]);
  return (
    <input
      aria-label="Draft"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
    />
  );
}
function Snapshot() {
  const auth = useAuthState();
  return <output data-user={auth.user?.id} data-loading={auth.loading} />;
}
async function mount() {
  await act(async () => {
    renderer = create(
      <MemoryRouter initialEntries={["/edit"]}>
        <AuthStateProvider>
          <Snapshot />
          <Routes>
            <Route
              path="/edit"
              element={
                <AuthGuard>
                  <DraftForm />
                </AuthGuard>
              }
            />
            <Route path="/auth" element={<p>Sign in required</p>} />
          </Routes>
        </AuthStateProvider>
      </MemoryRouter>
    );
  });
}
async function emit(event: AuthChangeEvent, value = session) {
  await act(async () => {
    listener(event, value);
    await vi.advanceTimersByTimeAsync(0);
  });
}
const draft = () => renderer.root.findAllByType("input")[0];
async function typeDraft() {
  await act(async () =>
    draft().props.onChange({
      target: { value: "Unfinished tournament description" },
    })
  );
}
function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
  mounts = 0;
  hydrations = 0;
  vi.stubGlobal("localStorage", storage());
  vi.stubGlobal("sessionStorage", storage());
  vi.stubGlobal(
    "window",
    Object.assign(new EventTarget(), { setInterval, clearInterval })
  );
  vi.stubGlobal(
    "document",
    Object.assign(new EventTarget(), { visibilityState: "visible" })
  );
  session = account("player-a");
  mocks.getSession.mockImplementation(async () => ({
    data: { session: structuredClone(session) },
    error: null,
  }));
  mocks.security.mockImplementation(async () => verified(session!.user.id));
  mocks.subscribe.mockImplementation((callback) => {
    listener = callback;
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  });
  mocks.from.mockImplementation(() => {
    const id = session!.user.id;
    const query = {
      select: () => query,
      eq: () => query,
      abortSignal: () => query,
      single: async () => ({
        data: {
          id,
          full_name: id,
          player_state: "active",
          tutorial_completed: true,
        },
        error: null,
      }),
    };
    return query;
  });
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("auth provider preserves mounted forms on resume", () => {
  it("keeps typed text through repeated same-account SIGNED_IN and TOKEN_REFRESHED events", async () => {
    await mount();
    await typeDraft();
    for (const event of [
      "SIGNED_IN",
      "TOKEN_REFRESHED",
      "SIGNED_IN",
    ] as AuthChangeEvent[])
      await emit(event, structuredClone(session));
    expect(draft().props.value).toBe("Unfinished tournament description");
    expect(mounts).toBe(1);
    expect(hydrations).toBe(1);
    expect(mocks.from).toHaveBeenCalledTimes(1);
    expect(mocks.security).toHaveBeenCalledTimes(4);
  });
  it("keeps the form visible while a background security request is still pending", async () => {
    await mount();
    await typeDraft();
    let finish!: (value: ReturnType<typeof verified>) => void;
    mocks.security.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    await emit("SIGNED_IN");
    expect(draft().props.value).toBe("Unfinished tournament description");
    expect(renderer.root.findByType("output").props["data-loading"]).toBe(
      false
    );
    await act(async () => finish(verified()));
    expect(mounts).toBe(1);
  });
  it("checks visibility and periodic security without refetching profile data or resetting a draft", async () => {
    await mount();
    await typeDraft();
    Object.assign(document, { visibilityState: "hidden" });
    await act(async () =>
      document.dispatchEvent(new Event("visibilitychange"))
    );
    expect(mocks.security).toHaveBeenCalledTimes(1);
    Object.assign(document, { visibilityState: "visible" });
    await act(async () =>
      document.dispatchEvent(new Event("visibilitychange"))
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(draft().props.value).toBe("Unfinished tournament description");
    expect(mocks.from).toHaveBeenCalledTimes(1);
    expect(mocks.security).toHaveBeenCalledTimes(3);
  });
  it("keeps an already verified draft through temporary connection failures and recovery", async () => {
    await mount();
    await typeDraft();
    mocks.security.mockRejectedValueOnce(
      Object.assign(new Error("offline"), { name: "AuthRetryableFetchError" })
    );
    await emit("TOKEN_REFRESHED");
    expect(draft().props.value).toBe("Unfinished tournament description");
    await emit("SIGNED_IN");
    expect(draft().props.value).toBe("Unfinished tournament description");
    expect(mounts).toBe(1);
  });
  it("still withholds the form when initial security verification is unavailable", async () => {
    mocks.security.mockRejectedValue(
      Object.assign(new Error("offline"), { name: "AuthRetryableFetchError" })
    );
    await mount();
    expect(draft()).toBeUndefined();
    expect(mounts).toBe(0);
  });
  it("removes the previous account’s view immediately when accounts change", async () => {
    await mount();
    await typeDraft();
    let finish!: (value: ReturnType<typeof verified>) => void;
    session = account("player-b");
    mocks.security.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    await emit("SIGNED_IN");
    expect(draft()).toBeUndefined();
    await act(async () => finish(verified("player-b")));
    expect(draft().props.value).toBe("player-b");
    expect(mounts).toBe(2);
  });
  it("does not restore a draft when an old verification completes after sign-out", async () => {
    await mount();
    await typeDraft();
    let finish!: (value: ReturnType<typeof verified>) => void;
    mocks.security.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    await emit("SIGNED_IN");
    session = null;
    await emit("SIGNED_OUT", null);
    await act(async () => finish(verified()));
    expect(draft()).toBeUndefined();
    expect(
      renderer.root.findByType("output").props["data-user"]
    ).toBeUndefined();
  });
  it("still blocks the view when the server reports verification is required", async () => {
    await mount();
    await typeDraft();
    mocks.security.mockResolvedValueOnce({
      ...verified(),
      verified: false,
      method: "email",
    });
    await emit("TOKEN_REFRESHED");
    expect(draft()).toBeUndefined();
  });
  it("does not bounce a signed-out page through a loader when visibility changes", async () => {
    session = null;
    await mount();
    await act(async () =>
      document.dispatchEvent(new Event("visibilitychange"))
    );
    expect(mocks.getSession).toHaveBeenCalledTimes(1);
    expect(renderer.root.findByType("output").props["data-loading"]).toBe(
      false
    );
  });
});
