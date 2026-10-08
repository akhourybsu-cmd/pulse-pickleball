import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRoundRobinLiveUpdates, ROUND_ROBIN_REFRESH_INTERVAL_MS } from "@/hooks/useRoundRobinLiveUpdates";

const realtime = vi.hoisted(() => ({ channel: vi.fn(), removeChannel: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: realtime }));
type Listener = { table: string; filter: string; callback: () => void };
let listeners: Listener[];
let connection: (status: string) => void;
let doc: EventTarget & { visibilityState: string };
let win: EventTarget;
let network: { onLine: boolean };
let root: ReactTestRenderer;
let read: ReturnType<typeof vi.fn<() => Promise<void>>>;
let result: ReturnType<typeof useRoundRobinLiveUpdates>;
function View({ eventId = "event-a", userId = "player-a" }: { eventId?: string; userId?: string }) {
  result = useRoundRobinLiveUpdates(eventId, userId, read);
  return null;
}
const tick = async (ms = 180) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
const emit = (table: string) => listeners.find(listener => listener.table === table)!.callback();
async function mount(props = {}) { await act(async () => { root = create(<View {...props} />); }); }
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  listeners = [];
  doc = Object.assign(new EventTarget(), { visibilityState: "visible" });
  win = new EventTarget();
  network = { onLine: true };
  vi.stubGlobal("document", doc);
  vi.stubGlobal("window", win);
  vi.stubGlobal("navigator", network);
  read = vi.fn().mockResolvedValue(undefined);
  realtime.channel.mockImplementation(() => {
    const channel = {
      on: (_type: string, filter: Omit<Listener, "callback">, callback: () => void) => {
        listeners.push({ ...filter, callback }); return channel;
      },
      subscribe: (callback: typeof connection) => { connection = callback; return channel; },
    };
    return channel;
  });
});
afterEach(() => {
  act(() => root?.unmount());
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("round-robin live data updates", () => {
  it.each(["round_robin_schedule", "round_robin_events", "round_robin_players"])("refreshes %s changes using only this event's channel", async (table) => {
    await mount();
    expect(read).toHaveBeenCalledTimes(1);
    expect(listeners.map(({ table, filter }) => [table, filter])).toEqual([
      ["round_robin_events", "id=eq.event-a"],
      ["round_robin_schedule", "event_id=eq.event-a"],
      ["round_robin_players", "event_id=eq.event-a"],
    ]);
    emit(table);
    await tick();
    expect(read).toHaveBeenCalledTimes(2);
  });
  it("coalesces a schedule rebuild and reads again after reconnecting", async () => {
    await mount();
    for (let row = 0; row < 100; row++) emit("round_robin_schedule");
    emit("round_robin_events");
    await tick();
    expect(read).toHaveBeenCalledTimes(2);
    connection("CHANNEL_ERROR");
    connection("SUBSCRIBED");
    await tick();
    expect(read).toHaveBeenCalledTimes(3);
  });
  it("catches missed notifications with foreground polling", async () => {
    await mount();
    await tick(ROUND_ROBIN_REFRESH_INTERVAL_MS + 180);
    expect(read).toHaveBeenCalledTimes(2);
  });
  it("pauses automatic reads while hidden or offline, then catches up on return", async () => {
    await mount();
    doc.visibilityState = "hidden";
    emit("round_robin_events");
    await tick(ROUND_ROBIN_REFRESH_INTERVAL_MS * 2);
    expect(read).toHaveBeenCalledTimes(1);
    doc.visibilityState = "visible";
    doc.dispatchEvent(new Event("visibilitychange"));
    win.dispatchEvent(new Event("focus"));
    await tick();
    expect(read).toHaveBeenCalledTimes(2);
    network.onLine = false;
    await tick(ROUND_ROBIN_REFRESH_INTERVAL_MS * 2);
    expect(read).toHaveBeenCalledTimes(2);
    network.onLine = true;
    win.dispatchEvent(new Event("online"));
    await tick();
    expect(read).toHaveBeenCalledTimes(3);
  });
  it("never overlaps slow reads and retains a newer score change during a read", async () => {
    let finish!: () => void;
    read.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
    await mount();
    expect(result.refreshing).toBe(true);
    // Polls must not queue endless follow-up reads on a slow connection.
    await tick(ROUND_ROBIN_REFRESH_INTERVAL_MS * 2);
    expect(read).toHaveBeenCalledTimes(1);
    emit("round_robin_schedule");
    await tick();
    emit("round_robin_events");
    await tick();
    expect(read).toHaveBeenCalledTimes(1);
    await act(async () => { finish(); });
    expect(read).toHaveBeenCalledTimes(2);
    expect(result.refreshing).toBe(false);
  });
  it("allows manual refresh and recovers after a failed read", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    read.mockRejectedValueOnce(new Error("Connection lost"));
    await mount();
    expect(result.refreshing).toBe(false);
    await act(async () => { await result.refresh(); });
    expect(read).toHaveBeenCalledTimes(2);
    expect(result.refreshing).toBe(false);
  });
  it("cleans up timers, listeners, and queued reads on unmount", async () => {
    let finish!: () => void;
    read.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
    await mount();
    emit("round_robin_schedule");
    await tick();
    act(() => root.unmount());
    await act(async () => { finish(); });
    win.dispatchEvent(new Event("focus"));
    connection("SUBSCRIBED");
    await tick(ROUND_ROBIN_REFRESH_INTERVAL_MS * 2);
    expect(read).toHaveBeenCalledTimes(1);
    expect(realtime.removeChannel).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("replaces the channel when the player opens another event", async () => {
    await mount();
    const oldListeners = [...listeners];
    await act(async () => { root.update(<View eventId="event-b" />); });
    expect(realtime.removeChannel).toHaveBeenCalledTimes(1);
    expect(realtime.channel).toHaveBeenLastCalledWith("round-robin-changes-event-b");
    oldListeners[0].callback();
    await tick();
    expect(read).toHaveBeenCalledTimes(2);
  });
  it("does not subscribe or read without a signed-in player", async () => {
    await mount({ userId: "" });
    await tick(ROUND_ROBIN_REFRESH_INTERVAL_MS * 2);
    expect(realtime.channel).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
  });
});
