import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ authenticated: false, rpc: vi.fn() }));
vi.mock("@/hooks/useAuthState", () => ({
  useAuthState: () => ({
    isAuthenticated: state.authenticated,
    user: state.authenticated ? { id: "player" } : null,
  }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: state.rpc },
}));
vi.mock("@/components/community/InviteModal", () => ({
  InviteModal: () => null,
}));
import JoinGroupByCode from "@/pages/player/JoinGroupByCode";
import { CommunityDirectoryRoute } from "@/pages/public/PublicCommunityLayout";
import { peekPostAuthRedirect } from "@/lib/authRedirect";

let renderer: ReactTestRenderer;
let cache: QueryClient;
let navigate: ReturnType<typeof useNavigate>;
let path: string;
const memory = () => {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) || null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  };
};
const preview = (code: string) => ({
  id: code,
  name: code === "RALLY" ? "Rally House Sports" : "11-0 Pickleball",
  description: "Your community on court.",
  visibility: "private",
  member_count: 42,
  join_method: "open",
  is_expired: false,
});
function Location() {
  navigate = useNavigate();
  const value = useLocation();
  path = value.pathname + value.search;
  return null;
}
async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 15));
  });
}
async function mount(entry = "/player/community/join/RALLY") {
  cache = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  await act(async () => {
    renderer = create(
      <QueryClientProvider client={cache}>
        <MemoryRouter initialEntries={[entry]}>
          <Location />
          <Routes>
            <Route
              path="/player/community/join/:code"
              element={<JoinGroupByCode />}
            />
            <Route
              path="/player/community"
              element={<CommunityDirectoryRoute />}
            />
            <Route path="*" element={<p>Destination</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  });
  await flush();
}
const text = () => JSON.stringify(renderer.toJSON());
const joins = () =>
  state.rpc.mock.calls.filter(([name]) => name === "join_group_by_code");
beforeEach(() => {
  state.authenticated = false;
  vi.stubGlobal("sessionStorage", memory());
  vi.stubGlobal("localStorage", memory());
  state.rpc
    .mockReset()
    .mockImplementation((name: string, args: { p_code: string }) => ({
      abortSignal: () =>
        Promise.resolve({
          data:
            name === "find_group_by_invite_code"
              ? [preview(args.p_code)]
              : name === "join_group_by_code"
              ? { status: "joined", group_id: args.p_code }
              : null,
          error: null,
        }),
    }));
});
afterEach(async () => {
  await act(async () => renderer?.unmount());
  cache?.clear();
  vi.unstubAllGlobals();
});
describe("guest community invite flow", () => {
  it("shows the specific community without an account or a membership write; both account links preserve the code", async () => {
    await mount();
    expect(text()).toContain("Rally House Sports");
    expect(joins()).toHaveLength(0);
    const links = renderer.root
      .findAllByType("a")
      .filter((node) => node.props.href?.startsWith("/auth?"));
    expect(links).toHaveLength(2);
    expect(
      links.map((node) =>
        new URL(node.props.href, "https://pulsepb.com").searchParams.get("mode")
      )
    ).toEqual(["signup", "signin"]);
    for (const link of links)
      expect(
        new URL(link.props.href, "https://pulsepb.com").searchParams.get(
          "redirect"
        )
      ).toBe("/player/community/join/RALLY");
  });
  it("repairs old shared ?join links before showing a generic directory", async () => {
    await mount("/player/community?join=RALLY");
    expect(path).toBe("/player/community/join/RALLY");
    expect(text()).toContain("Rally House Sports");
  });
  it.each(["joined", "already_member"])(
    "takes a %s player straight to the exact community",
    async (status) => {
      state.authenticated = true;
      const base = state.rpc.getMockImplementation()!;
      state.rpc.mockImplementation((name, args) =>
        name === "join_group_by_code"
          ? {
              abortSignal: () =>
                Promise.resolve({
                  data: { status, group_id: args.p_code },
                  error: null,
                }),
            }
          : base(name, args)
      );
      await mount();
      await flush();
      expect(joins()).toHaveLength(1);
      expect(path).toBe("/player/community/group/RALLY");
      expect(peekPostAuthRedirect()).toBe(path);
    }
  );
  it('opens existing public invitations on the overview without joining as a guest', async () => {
    const base = state.rpc.getMockImplementation()!;
    state.rpc.mockImplementation((name,args) => name === 'get_public_community' || name === 'get_public_community_programs' ? {
      abortSignal: () => Promise.resolve({data:name === 'get_public_community' ? {...preview('RALLY'),visibility:'public',courts:[],venue:null} : [],error:null})
    } : base(name,args));
    await mount(); await flush();
    expect(text()).toContain('Overview');
    expect(text()).toContain('Welcome to');
    expect(joins()).toHaveLength(0);
  });
  it('removes the signed-out Explore directory while preserving the signed-in destination', async () => {
    await mount('/player/community');
    expect(path).toBe('/auth?mode=signin&redirect=%2Fplayer%2Fcommunity');
  });
  it("keeps approval requests distinct from successful membership", async () => {
    state.authenticated = true;
    const base = state.rpc.getMockImplementation()!;
    state.rpc.mockImplementation((name, args) =>
      name === "join_group_by_code"
        ? {
            abortSignal: () =>
              Promise.resolve({
                data: { status: "pending", group_id: args.p_code },
                error: null,
              }),
          }
        : base(name, args)
    );
    await mount();
    await flush();
    expect(path).toBe("/player/community/join/RALLY");
    expect(text()).toContain("Your request has been sent");
    expect(text()).toContain("approve your request");
  });
  it("switches invitations cleanly and ignores a previous join finishing late", async () => {
    state.authenticated = true;
    let finish!: (value: unknown) => void;
    const base = state.rpc.getMockImplementation()!;
    state.rpc.mockImplementation((name, args) =>
      name === "join_group_by_code" && args.p_code === "RALLY"
        ? {
            abortSignal: () =>
              new Promise((resolve) => {
                finish = resolve;
              }),
          }
        : base(name, args)
    );
    await mount();
    await act(async () => navigate("/player/community/join/ELEVEN"));
    await flush();
    await flush();
    expect(path).toBe("/player/community/group/ELEVEN");
    await act(async () =>
      finish({ data: { status: "joined", group_id: "RALLY" }, error: null })
    );
    expect(path).toBe("/player/community/group/ELEVEN");
  });
  it("distinguishes connection errors, revoked and expired invitations without joining", async () => {
    for (const data of [[], [{ ...preview("RALLY"), is_expired: true }]]) {
      state.rpc.mockReturnValue({
        abortSignal: () => Promise.resolve({ data, error: null }),
      });
      await mount();
      expect(text()).toMatch(
        /Invitation not available|This invitation has expired/
      );
      expect(joins()).toHaveLength(0);
      await act(async () => renderer.unmount());
      cache.clear();
    }
    state.rpc.mockReturnValue({
      abortSignal: () => Promise.reject(new Error("Offline")),
    });
    await mount();
    expect(text()).toContain("Your invitation is still here");
    expect(text()).toContain("Try again");
  });
});
