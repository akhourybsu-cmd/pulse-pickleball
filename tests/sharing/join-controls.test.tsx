import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import {
  MemoryRouter,
  Routes,
  Route,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  rpc: vi.fn(),
  auth: {
    user: null as null | { id: string },
    isAuthenticated: false,
    loading: false,
  },
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: state.rpc },
}));
vi.mock("@/hooks/useAuthState", () => ({ useAuthState: () => state.auth }));
vi.mock("@/components/Logo", () => ({ Logo: () => <span>PULSE</span> }));
vi.mock("@/components/ui/dialog", () => {
  const Box = ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  );
  return {
    Dialog: ({
      open,
      children,
    }: {
      open: boolean;
      children: React.ReactNode;
    }) => (open ? <div>{children}</div> : null),
    DialogContent: Box,
    DialogHeader: Box,
    DialogTitle: Box,
    DialogDescription: Box,
    DialogFooter: Box,
  };
});
import JoinLeagueByCode from "@/pages/player/JoinLeagueByCode";
import { JoinByCodeDialog } from "@/components/leagues/JoinByCodeDialog";
import { JoinGroupDialog } from "@/components/community/JoinGroupDialog";
import { joinLeagueInvitation } from "@/lib/leagues/invitations";

let root: ReactTestRenderer, client: QueryClient;
let navigate: ReturnType<typeof useNavigate>, path: string;
const teaser = (code = "FALL") => ({
  id: code,
  name: `${code} Courtside League`,
  league_type: "ladder",
  registration_open: true,
  registration_closes_at: "2027-02-01",
});
function request(result: unknown) {
  const promise = Promise.resolve(result);
  return Object.assign(promise, { abortSignal: () => promise });
}
function Location() {
  navigate = useNavigate();
  const location = useLocation();
  path = location.pathname + location.search;
  return <p>{path}</p>;
}
async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}
async function mount(content?: React.ReactNode) {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  await act(async () => {
    root = create(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/player/leagues/join/FALL"]}>
          <Location />
          {content || (
            <Routes>
              <Route
                path="/player/leagues/join/:code"
                element={<JoinLeagueByCode />}
              />
              <Route path="*" element={<p>Destination</p>} />
            </Routes>
          )}
        </MemoryRouter>
      </QueryClientProvider>
    );
  });
  await flush();
}
const visible = () => JSON.stringify(root.toJSON());
const button = (label: string) =>
  root.root
    .findAllByType("button")
    .find((node) => JSON.stringify(node.children).includes(label))!;
beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(state.auth, {
    user: null,
    isAuthenticated: false,
    loading: false,
  });
  state.rpc.mockImplementation((name: string, args: { p_code: string }) =>
    request({
      data:
        name === "find_league_by_invite_code"
          ? [teaser(args.p_code)]
          : args.p_code,
      error: null,
    })
  );
});
afterEach(() => {
  act(() => root?.unmount());
  client?.clear();
  vi.useRealTimers();
});

it("previews an invitation and uses signup mode with an explicit return path without browser storage", async () => {
  await mount();
  expect(visible()).toContain("FALL Courtside League");
  await act(async () => button("Create an account").props.onClick());
  const params = new URLSearchParams(path.split("?")[1]);
  expect(params.get("mode")).toBe("signup");
  expect(params.get("redirect")).toBe("/player/leagues/join/FALL");
  expect(state.rpc).toHaveBeenCalledTimes(1);
});
it("requires an explicit join, deduplicates rapid clicks and only opens a confirmed membership", async () => {
  Object.assign(state.auth, { user: { id: "player" }, isAuthenticated: true });
  await mount();
  expect(state.rpc).toHaveBeenCalledTimes(1);
  const click = button("Join league").props.onClick;
  await act(async () => {
    click();
    click();
  });
  await flush();
  expect(
    state.rpc.mock.calls.filter(([name]) => name === "join_league_by_code")
  ).toHaveLength(1);
  expect(visible()).toContain("You joined ");
  expect(visible()).toContain("FALL Courtside League");
});
it("ignores a join response after navigating to a different invitation", async () => {
  Object.assign(state.auth, { user: { id: "player" }, isAuthenticated: true });
  let finish!: (value: unknown) => void;
  state.rpc.mockImplementation((name: string, args: { p_code: string }) =>
    name === "join_league_by_code"
      ? request(
          new Promise((resolve) => {
            finish = resolve;
          })
        )
      : request({ data: [teaser(args.p_code)], error: null })
  );
  await mount();
  act(() => {
    button("Join league").props.onClick();
  });
  await act(async () => navigate("/player/leagues/join/SPRING"));
  await flush();
  await act(async () => finish({ data: "FALL", error: null }));
  expect(visible()).toContain("SPRING Courtside League");
  expect(visible()).not.toContain("You joined");
});
it("recovers from a failed preview with an inline retry", async () => {
  state.rpc.mockImplementationOnce(() =>
    request(Promise.reject(new TypeError("Fetch failed")))
  );
  await mount();
  expect(visible()).toContain("could not connect");
  await act(async () => button("Try again").props.onClick());
  await flush();
  expect(visible()).toContain("FALL Courtside League");
});
it.each([null, { id: "FALL" }, "DIFFERENT"])(
  "rejects an unconfirmed join response %j",
  async (data) => {
    state.rpc.mockImplementationOnce(() => request({ data, error: null }));
    await expect(joinLeagueInvitation("FALL", "FALL")).rejects.toThrow(
      "could not confirm"
    );
  }
);
it("bounds a stalled authentication/request lock and permits a later retry", async () => {
  vi.useFakeTimers();
  state.rpc.mockImplementationOnce(() => request(new Promise(() => {})));
  const result = expect(
    joinLeagueInvitation("FALL", "FALL")
  ).rejects.toMatchObject({ name: "TimeoutError" });
  await vi.advanceTimersByTimeAsync(15_000);
  await result;
  await expect(joinLeagueInvitation("FALL", "FALL")).resolves.toBe("FALL");
});
it("keeps the previewed invitation when the code input changes during a lookup", async () => {
  const onJoined = vi.fn();
  await mount(
    <JoinByCodeDialog open onOpenChange={() => {}} onJoined={onJoined} />
  );
  act(() =>
    root.root.findByType("input").props.onChange({ target: { value: "FALL" } })
  );
  const input = root.root.findByType("input");
  act(() => {
    button("Find league").props.onClick();
    input.props.onChange({ target: { value: "SPRING" } });
  });
  await flush();
  await act(async () => button("Join league").props.onClick());
  await flush();
  expect(state.rpc).toHaveBeenCalledWith("join_league_by_code", {
    p_code: "FALL",
  });
  expect(onJoined).toHaveBeenCalledWith("FALL");
});
it("resets failed group submissions and guards repeated Enter presses", async () => {
  const onJoin = vi
    .fn()
    .mockRejectedValueOnce(new Error("Network failed"))
    .mockResolvedValue({ id: "group" });
  const onOpenChange = vi.fn();
  await mount(
    <JoinGroupDialog open onOpenChange={onOpenChange} onJoin={onJoin} />
  );
  act(() =>
    root.root
      .findByType("input")
      .props.onChange({ target: { value: " CODE " } })
  );
  const click = button("Join group").props.onClick;
  await act(async () => {
    click();
    click();
  });
  expect(onJoin).toHaveBeenCalledTimes(1);
  expect(visible()).toContain("could not connect");
  await act(async () => button("Join group").props.onClick());
  expect(onJoin).toHaveBeenLastCalledWith("CODE");
  expect(onOpenChange).toHaveBeenCalledWith(false);
});
