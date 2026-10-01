import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { MemoryRouter, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RoundRobinRegistration } from "@/components/round-robin/RoundRobinRegistration";
import { useRoundRobinEntry } from "@/hooks/useRoundRobinEntry";
import { clearPostAuthRedirect, consumePostAuthRedirect, DEFAULT_AUTH_DESTINATION, isRoundRobinReturnPath } from "@/lib/authRedirect";
import { roundRobinUrl, roundRobinPath, roundRobinJoinAction, shareRoundRobin, type RoundRobinEntryData } from "@/lib/roundRobin/sharing";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), auth: { user: null as { id: string } | null, loading: false, isAuthenticated: false }, toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: mocks.rpc } }));
vi.mock("@/hooks/useAuthState", () => ({ useAuthState: () => mocks.auth }));
vi.mock("sonner", () => ({ toast: mocks.toast }));
const eventId = "10000000-0000-4000-8000-000000000001";
const sample: RoundRobinEntryData = { event_id: eventId, name: "Friday Lights", date: "2026-11-06", start_time: "18:30:00", location: "Rally House",
  notes: "Arrive ten minutes before play.", status: "draft", format: "open", num_courts: 4, num_rounds: 5, registration_mode: "invite_only", registration_deadline: null,
  max_players: 18, confirmed_count: 12, waitlisted_count: 0, registration_status: null, waitlist_position: null, can_open: false, closed_reason: null,
  organizer_name: "Alex", venue_registration_path: null, price_cents: null, currency: null };
const storage = () => { const data = new Map<string, string>(); return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key,value), removeItem: (key: string) => data.delete(key) }; };
let current: RoundRobinEntryData | null;
let root: ReactTestRenderer | undefined;
let cache: QueryClient;
let saveStatus = "confirmed";
beforeEach(() => {
  current = { ...sample }; saveStatus = "confirmed";
  mocks.auth.user = null; mocks.auth.isAuthenticated = false;
  mocks.rpc.mockReset(); mocks.toast.success.mockClear(); mocks.toast.error.mockClear();
  vi.stubGlobal("sessionStorage", storage()); vi.stubGlobal("localStorage", storage());
  mocks.rpc.mockImplementation((name: string) => {
    if (name === "join_round_robin_event" && current) current = { ...current, registration_status: saveStatus, can_open: saveStatus === "confirmed", waitlist_position: saveStatus === "waitlisted" ? 1 : null };
    const result = Promise.resolve({ data: name === "get_round_robin_entry" ? current : { registration_status: saveStatus, message: "Your place is saved" }, error: null });
    return Object.assign(result, { abortSignal: () => result });
  });
  cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(async () => { if (root) await act(async () => root?.unmount()); root = undefined; cache.clear(); vi.unstubAllGlobals(); });
function Fixture() {
  const entry = useRoundRobinEntry(eventId, "ABC-1234");
  const location = useLocation();
  return <><RoundRobinRegistration entry={entry} eventId={eventId} inviteCode="ABC-1234" /><output>{location.pathname}{location.search}</output></>;
}
async function mount() {
  await act(async () => { root = create(<QueryClientProvider client={cache}><MemoryRouter><Fixture /></MemoryRouter></QueryClientProvider>); });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 15)); });
}
const button = (label: string) => root!.root.findAllByType("button").find(b => JSON.stringify(b.props.children).includes(label))!;

describe("shared round robin entry", () => {
  it("opens event details before sign-in and preserves the invitation through repeated auth resolution", async () => {
    await mount();
    expect(root!.root.findByType("h1").children).toContain("Friday Lights");
    await act(async () => { button("Join the Event").props.onClick(); });
    const path = roundRobinPath(eventId, "ABC-1234");
    expect(root!.root.findByType("output").children.join("")).toBe(`/auth?${new URLSearchParams({ redirect: path })}`);
    expect(consumePostAuthRedirect()).toBe(path); expect(consumePostAuthRedirect()).toBe(path);
    clearPostAuthRedirect(path); expect(consumePostAuthRedirect()).toBe(DEFAULT_AUTH_DESTINATION);
    expect(mocks.rpc.mock.calls.some(([name]) => name === "join_round_robin_event")).toBe(false);
  });
  it("confirms a signed-in registration with the invite and opens the event", async () => {
    mocks.auth.user = { id: "player" }; mocks.auth.isAuthenticated = true;
    await mount();
    await act(async () => { button("Join the Event").props.onClick(); await new Promise(resolve => setTimeout(resolve, 20)); });
    expect(mocks.rpc).toHaveBeenCalledWith("join_round_robin_event", { p_event_id: eventId, p_invite_code: "ABC-1234" });
    expect(root!.root.findByType("output").children.join("")).toBe(roundRobinPath(eventId, "ABC-1234"));
  });
  it("saves a full-event signup to the waitlist and shows its place without opening play", async () => {
    mocks.auth.user = { id: "player" }; mocks.auth.isAuthenticated = true; saveStatus = "waitlisted";
    current = { ...sample, confirmed_count: 18 };
    await mount();
    await act(async () => { button("Join the Waitlist").props.onClick(); await new Promise(resolve => setTimeout(resolve, 25)); });
    expect(button("You're on the Waitlist").props.disabled).toBe(true);
    expect(JSON.stringify(root!.toJSON())).toContain("position 1");
    expect(root!.root.findByType("output").children.join("")).toBe("/");
  });
  it("routes paid events to their venue registration without writing a round-robin signup", async () => {
    mocks.auth.user = { id: "player" }; mocks.auth.isAuthenticated = true;
    current = { ...sample, registration_mode: "immediate", venue_registration_path: "/player/community/group/venue?tab=events&program=program", price_cents: 2500, currency: "USD" };
    await mount();
    await act(async () => { button("Register").props.onClick(); });
    expect(root!.root.findByType("output").children.join("")).toBe(current.venue_registration_path);
    expect(mocks.rpc.mock.calls.some(([name]) => name === "join_round_robin_event")).toBe(false);
  });
  it("explains unavailable invitations and closed events instead of presenting a broken management page", async () => {
    current = null; await mount();
    expect(root!.root.findByType("h1").children).toContain("Have an invitation?");
    expect(roundRobinJoinAction({ ...sample, closed_reason: "Registration closed" })).toEqual({ label: "Registration Closed", disabled: true });
  });
  it("shows actionable registration errors without claiming success", async () => {
    mocks.auth.user = { id: "player" }; mocks.auth.isAuthenticated = true;
    await mount();
    mocks.rpc.mockImplementationOnce(() => Promise.resolve({ data: null, error: { message: "Registration has closed for this event." } }));
    await act(async () => { button("Join the Event").props.onClick(); await new Promise(resolve => setTimeout(resolve, 20)); });
    expect(JSON.stringify(root!.toJSON())).toContain("Registration has closed for this event.");
    expect(mocks.toast.success).not.toHaveBeenCalled();
  });
});
describe("portable sharing", () => {
  it("uses the public origin, carries the invite, and keeps legacy invitation auth returns", () => {
    expect(roundRobinUrl(eventId, " abc-1234 ")).toBe(`https://pulsepb.com/round-robin/${eventId}?invite=ABC-1234`);
    expect(roundRobinUrl(eventId)).toBe(`https://pulsepb.com/round-robin/${eventId}`);
    expect(isRoundRobinReturnPath(roundRobinPath(eventId,"ABC-1234"))).toBe(true);
    expect(isRoundRobinReturnPath("/player/play?invite=ABC-1234")).toBe(true);
    for (const path of ["//evil.example", "/round-robin/create", `/round-robin/${eventId}/kiosk`]) expect(isRoundRobinReturnPath(path)).toBe(false);
  });
  it("treats share cancellation quietly and reports clipboard failures truthfully", async () => {
    const writeText = vi.fn();
    vi.stubGlobal("navigator", { share: vi.fn().mockRejectedValue({ name: "AbortError" }), clipboard: { writeText } });
    expect(await shareRoundRobin(eventId,"Friday Lights","ABC-1234")).toBe("cancelled");
    expect(writeText).not.toHaveBeenCalled();
    vi.stubGlobal("navigator", { share: vi.fn().mockRejectedValue(new Error("Unavailable")), clipboard: { writeText: vi.fn().mockRejectedValue(new Error("Clipboard denied")) } });
    await expect(shareRoundRobin(eventId,"Friday Lights")).rejects.toThrow("Clipboard denied");
  });
});
