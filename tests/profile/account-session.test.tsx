import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  accountTabDestination,
  clearAccountSession,
  readAccountState,
  useAccountSessionState,
  writeAccountState,
} from "@/lib/accountSession";

let renderer: ReactTestRenderer;
let state: ReturnType<typeof useAccountSessionState<string[]>>;
const fallback: string[] = [];
function Harness({ user = "a" }: { user?: string }) {
  state = useAccountSessionState(user, "sections", fallback);
  return null;
}
beforeEach(() => {
  clearAccountSession();
});
afterEach(() => {
  act(() => renderer?.unmount());
  clearAccountSession();
  vi.unstubAllGlobals();
});

it("keeps the selected section across unmounts even when storage is blocked", () => {
  vi.stubGlobal("window", {
    get sessionStorage() {
      throw new Error("blocked");
    },
  });
  act(() => {
    renderer = create(<Harness />);
  });
  act(() => {
    state[1](["location", "playstyle"]);
  });
  act(() => renderer.unmount());
  act(() => {
    renderer = create(<Harness />);
  });
  expect(state[0]).toEqual(["location", "playstyle"]);
});
it("isolates state when the signed-in account changes", () => {
  act(() => {
    renderer = create(<Harness />);
  });
  act(() => {
    state[1](["identity"]);
  });
  act(() => renderer.update(<Harness user="b" />));
  expect(state[0]).toEqual([]);
  act(() => {
    state[1](["location"]);
  });
  expect(readAccountState("a", "sections", fallback)).toEqual(["identity"]);
  expect(readAccountState("b", "sections", fallback)).toEqual(["location"]);
});
it("restores same-tab storage after a cold start and removes only account state on sign-out", () => {
  const storage = {
    "pulse.account-session.v1:a:sections": '["playstyle"]',
    unrelated: "keep",
  } as Record<string, any>;
  Object.defineProperties(storage, {
    getItem: { value: (key: string) => storage[key] ?? null },
    removeItem: { value: (key: string) => delete storage[key] },
    setItem: { value: (key: string, value: string) => (storage[key] = value) },
  });
  vi.stubGlobal("window", { sessionStorage: storage });
  expect(readAccountState("a", "sections", fallback)).toEqual(["playstyle"]);
  clearAccountSession();
  expect(readAccountState("a", "sections", fallback)).toEqual([]);
  expect(storage.unrelated).toBe("keep");
});
it("returns to the last account page from another tab and to the overview from settings", () => {
  writeAccountState("a", "last-page", "/player/profile/security");
  expect(accountTabDestination("a", "/player/community")).toBe(
    "/player/profile/security"
  );
  expect(accountTabDestination("a", "/player/profile/edit")).toBe(
    "/player/profile"
  );
  expect(accountTabDestination("b", "/player/community")).toBe(
    "/player/profile"
  );
});
it("never restores an arbitrary external, payment callback or another player profile route", () => {
  for (const path of [
    "https://example.com",
    "/player/profile/someone",
    "/venue-payment/token",
  ]) {
    writeAccountState("a", "last-page", path);
    expect(accountTabDestination("a", "/player/community")).toBe(
      "/player/profile"
    );
  }
});
it("does not let a late save recreate drafts after sign-out", () => {
  act(() => {
    renderer = create(<Harness />);
  });
  const lateUpdate = state[1];
  clearAccountSession();
  act(() => {
    lateUpdate(["identity"]);
  });
  expect(readAccountState("a", "sections", fallback)).toEqual([]);
});
