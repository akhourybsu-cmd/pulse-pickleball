import React from "react";
import {
  act,
  create,
  type ReactTestInstance,
  type ReactTestRenderer,
} from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  createEvent: vi.fn(),
  success: vi.fn(),
  close: vi.fn(),
  pending: vi.fn(),
}));
vi.mock("@/hooks/useGroupEvents", () => ({
  useGroupEvents: () => ({ createEvent: mocks.createEvent }),
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ isSuccess: false, isFetching: false }),
}));
vi.mock("@/lib/venues/programAvailability", () => ({
  fetchProgramAvailability: vi.fn(),
}));
// Exercise the real steps and handlers; native equivalents replace portal-only controls.
vi.mock("@/components/ui/select", () => ({
  Select: ({ value, onValueChange, children }: any) => (
    <select value={value} onChange={(e) => onValueChange(e.target.value)}>
      {children}
    </select>
  ),
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectItem: ({ value, children }: any) => (
    <option value={value}>{children}</option>
  ),
}));
vi.mock("@/components/ui/switch", () => ({
  Switch: ({ checked, onCheckedChange, ...props }: any) => (
    <button
      {...props}
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
    />
  ),
}));
import { EventWizardContainer } from "@/components/community/event-wizard/EventWizardContainer";
import { INITIAL_EVENT_WIZARD_DATA } from "@/components/community/event-wizard/types";
import {
  canVisitGroupEventStep,
  groupEventStepError,
} from "@/components/community/event-wizard/groupFlow";

let view: ReactTestRenderer;
const text = (node: ReactTestInstance): string =>
  node.children
    .map((child) => (typeof child === "string" ? child : text(child)))
    .join("");
const button = (label: string) =>
  view.root.findAll(
    (node) => node.type === "button" && text(node) === label
  )[0];
const click = async (label: string) => {
  const node = button(label);
  expect(node, `Button ${label}`).toBeDefined();
  expect(node.props.disabled).not.toBe(true);
  await act(async () => {
    await node.props.onClick();
  });
};
const change = (key: string, value: string) => {
  const node = view.root.findAll(
    (node) =>
      (node.type === "input" || node.type === "textarea") &&
      (node.props.id === key || node.props["aria-label"] === key)
  )[0];
  act(() => node.props.onChange({ target: { value } }));
};
const select = (index: number, value: string) =>
  act(() =>
    view.root
      .findAllByType("select")
      [index].props.onChange({ target: { value } })
  );
const start = async (
  type = "Open PlayDrop-in games with a player rotation"
) => {
  await click(type);
  expect(button("Continue").props.disabled).toBe(false);
  await click("Continue");
  change("event-date", "2027-11-03");
  change("event-start", "09:00");
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.createEvent.mockResolvedValue({ id: "created" });
  act(() => {
    view = create(
      <EventWizardContainer
        groupId="club"
        onClose={mocks.close}
        onSuccess={mocks.success}
        onPendingChange={mocks.pending}
      />
    );
  });
});
afterEach(() => act(() => view.unmount()));

it("keeps format selection on Basics, preserves custom names, and prevents premature step jumps", async () => {
  expect(button("Continue").props.disabled).toBe(true);
  expect(button("2.Schedule").props.disabled).toBe(true);
  await click("Open PlayDrop-in games with a player rotation");
  change("event-title", "Sunday with the crew");
  const roundRobin = view.root.findAll(
    (node) => node.type === "button" && text(node).startsWith("Round Robin")
  )[0];
  act(() => roundRobin.props.onClick());
  expect(
    view.root
      .findAllByType("input")
      .find((node) => node.props.id === "event-title")?.props.value
  ).toBe("Sunday with the crew");
  expect(button("1.Basics").props["aria-current"]).toBe("step");
  expect(mocks.createEvent).not.toHaveBeenCalled();
});

it("blocks an invalid time window, restores entries on back, and publishes once from review", async () => {
  await start();
  change("event-end", "08:00");
  expect(button("Continue").props.disabled).toBe(true);
  change("event-end", "11:00");
  change("event-location", "North park courts");
  await click("Continue");
  await click("Review event");
  await click("Edit schedule");
  expect(
    view.root
      .findAllByType("input")
      .find((node) => node.props.id === "event-location")?.props.value
  ).toBe("North park courts");
  change("event-start", "09:30");
  await click("Return to review");
  await click("Create event");
  expect(mocks.createEvent).toHaveBeenCalledTimes(1);
  expect(mocks.createEvent).toHaveBeenCalledWith(
    expect.objectContaining({
      title: "Open Play Session",
      start_time: new Date("2027-11-03T09:30").toISOString(),
      end_time: new Date("2027-11-03T11:00").toISOString(),
      custom_location: "North park courts",
      event_format: "open_play",
      waitlist_enabled: false,
    })
  );
  expect(mocks.success).toHaveBeenCalledTimes(1);
});

it("retains round robin, recurrence and waitlist settings through review edits and a failed save", async () => {
  const rr = view.root.findAll(
    (node) => node.type === "button" && text(node).startsWith("Round Robin")
  )[0];
  act(() => rr.props.onClick());
  await click("Continue");
  change("event-date", "2027-11-03");
  change("event-start", "17:30");
  select(0, "weekly");
  select(1, "4");
  await click("Continue");
  change("Round robin courts", "4");
  change("Games per player", "6");
  change("Player capacity", "24");
  change("Waitlist capacity", "8");
  await click("Review event");
  await click("Edit basics");
  change("event-title", "Wednesday round robin");
  await click("Return to review");
  mocks.createEvent.mockRejectedValueOnce(new Error("Please try again"));
  await click("Create event");
  expect(mocks.success).not.toHaveBeenCalled();
  expect(text(view.root)).toContain("Please try again");
  await click("Create event");
  expect(mocks.createEvent.mock.calls[1][0]).toMatchObject({
    title: "Wednesday round robin",
    event_format: "round_robin",
    rr_courts: 4,
    rr_games_per_player: 6,
    capacity: 24,
    waitlist_enabled: true,
    waitlist_limit: 8,
    recurring_rule: "WEEKLY:4",
  });
  expect(mocks.createEvent.mock.calls[1][0].additional_starts).toHaveLength(3);
  expect(mocks.pending.mock.calls.map(([value]) => value)).toEqual([
    true,
    false,
    true,
    false,
  ]);
});

it("disables submission, close and navigation during a pending save", async () => {
  let resolve!: (value: unknown) => void;
  mocks.createEvent.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      })
  );
  await start();
  await click("Continue");
  await click("Review event");
  act(() => {
    button("Create event").props.onClick();
  });
  expect(button("Creating…").props.disabled).toBe(true);
  expect(button("Back").props.disabled).toBe(true);
  expect(button("1.Basics").props.disabled).toBe(true);
  expect(
    view.root.findAll(
      (node) =>
        node.type === "button" &&
        node.props["aria-label"] === "Close event creation"
    )[0].props.disabled
  ).toBe(true);
  await act(async () => resolve({ id: "done" }));
  expect(mocks.createEvent).toHaveBeenCalledTimes(1);
});

it("revalidates previous sections before returning to review and rejects invalid player counts", () => {
  const data = {
    ...INITIAL_EVENT_WIZARD_DATA,
    eventType: "round_robin" as const,
    title: "Games",
    date: "2027-11-03",
    startTime: "09:00",
  };
  expect(canVisitGroupEventStep(3, 3, data)).toBe(true);
  expect(canVisitGroupEventStep(3, 3, { ...data, title: " " })).toBe(false);
  expect(canVisitGroupEventStep(3, 2, data)).toBe(false);
  expect(groupEventStepError("details", { ...data, capacity: -2 })).toContain(
    "Capacity"
  );
  expect(groupEventStepError("details", { ...data, rrCourts: 21 })).toContain(
    "Courts"
  );
  expect(
    groupEventStepError("details", {
      ...data,
      capacity: 16,
      waitlistEnabled: false,
      waitlistLimit: -1,
    })
  ).toBeNull();
});
