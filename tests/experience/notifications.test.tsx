import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  active: vi.fn(),
  error: vi.fn(),
  toast: vi.fn(),
  channel: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mocks.from,
    channel: mocks.channel,
    removeChannel: mocks.remove,
  },
}));
vi.mock("@/contexts/ActiveViewContext", () => ({
  useActiveView: () => ({ isContextActive: mocks.active }),
}));
vi.mock("sonner", () => ({
  toast: Object.assign(mocks.toast, { error: mocks.error }),
}));
import {
  useNotifications,
  useNotificationPreferences,
  type Notification,
} from "@/hooks/useNotifications";

let rows: Notification[],
  preferences: Record<string, unknown>[],
  fail: boolean,
  renderer: ReactTestRenderer;
let current: ReturnType<typeof useNotifications>,
  prefs: ReturnType<typeof useNotificationPreferences>;
let listener: (payload: unknown) => void;
let writes: number;
const row = (id: string, patch: Partial<Notification> = {}): Notification => ({
  id,
  user_id: "a",
  notification_type: "test",
  category: "events",
  priority: "normal",
  title: id,
  message: "Hello",
  link: null,
  read: false,
  metadata: {},
  actor_id: null,
  expires_at: null,
  created_at: new Date().toISOString(),
  dismissed_at: null,
  ...patch,
});
function Harness({
  user = "a",
  categories,
}: {
  user?: string;
  categories?: string[];
}) {
  current = useNotifications(user, { categories });
  prefs = useNotificationPreferences(user);
  return null;
}
// A lazy, stateful query builder: writes execute only when awaited, like PostgREST.
function query(table: string) {
  let updates: Record<string, unknown> | undefined,
    upsert: Record<string, unknown> | undefined,
    head = false,
    limit = Infinity,
    single = false;
  const filters: ((r: Record<string, unknown>) => boolean)[] = [];
  const builder = {
    select: (_?: string, options?: { head?: boolean }) => {
      head = options?.head ?? false;
      return builder;
    },
    update: (value: Record<string, unknown>) => {
      updates = value;
      return builder;
    },
    upsert: (value: Record<string, unknown>) => {
      upsert = value;
      return builder;
    },
    eq: (key: string, value: unknown) => {
      filters.push((r) => r[key] === value);
      return builder;
    },
    is: (key: string, value: unknown) => {
      filters.push((r) => r[key] === value);
      return builder;
    },
    in: (key: string, value: unknown[]) => {
      filters.push((r) => value.includes(r[key]));
      return builder;
    },
    or: () => {
      filters.push(
        (r) => !r.expires_at || Date.parse(r.expires_at as string) > Date.now(),
      );
      return builder;
    },
    order: () => builder,
    limit: (value: number) => {
      limit = value;
      return builder;
    },
    single: () => {
      single = true;
      return builder;
    },
    then: (
      resolve: (r: unknown) => unknown,
      reject?: (r: unknown) => unknown,
    ) =>
      Promise.resolve()
        .then(() => {
          if (fail && (updates || upsert))
            return { data: null, error: new Error("Save unavailable") };
          const source =
            table === "notification_preferences"
              ? preferences
              : (rows as unknown as Record<string, unknown>[]);
          if (upsert) {
            writes++;
            let saved = source.find(
              (r) =>
                r.user_id === upsert!.user_id &&
                r.category === upsert!.category,
            );
            if (!saved) {
              saved = {
                id: "preference",
                in_app_enabled: true,
                push_enabled: true,
                email_enabled: true,
              };
              source.push(saved);
            }
            Object.assign(saved, upsert);
            return { data: saved, error: null };
          }
          const selected = source.filter((r) => filters.every((f) => f(r)));
          if (updates) {
            writes++;
            selected.forEach((r) => Object.assign(r, updates));
          }
          return {
            data: head
              ? null
              : single
                ? selected[0]
                : selected.slice(0, limit).map((r) => ({ ...r })),
            count: selected.length,
            error: null,
          };
        })
        .then(resolve, reject),
  };
  return builder;
}
beforeEach(() => {
  rows = [row("one"), row("two", { read: true })];
  preferences = [];
  fail = false;
  writes = 0;
  vi.clearAllMocks();
  mocks.active.mockReturnValue(false);
  mocks.from.mockImplementation(query);
  mocks.channel.mockImplementation(() => {
    const channel = {
      on: (_: unknown, __: unknown, cb: typeof listener) => {
        listener = cb;
        return channel;
      },
      subscribe: () => channel,
    };
    return channel;
  });
  vi.stubGlobal("window", {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    location: { href: "" },
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
async function mount(props: React.ComponentProps<typeof Harness> = {}) {
  await act(async () => {
    renderer = create(<Harness {...props} />);
  });
}
it("dismisses and restores the stored notification, with counts stable across repeated reads", async () => {
  await mount();
  expect(current.unreadCount).toBe(1);
  const original = current.notifications[0];
  await act(async () => {
    expect(await current.deleteNotification("one")).toBe(true);
  });
  expect(rows[0].dismissed_at).toBeTruthy();
  expect(current.notifications.map((n) => n.id)).toEqual(["two"]);
  expect(current.unreadCount).toBe(0);
  await act(async () => {
    await current.restoreNotification(original);
  });
  expect(current.unreadCount).toBe(1);
  expect(rows[0].dismissed_at).toBeNull();
  await act(async () => {
    await current.markAsRead("one");
    await current.markAsRead("one");
    await current.deleteNotification("two");
  });
  expect(current.unreadCount).toBe(0);
  expect(rows).toHaveLength(2);
});
it("uses the full unread count beyond the display limit and excludes expired/category-hidden items", async () => {
  rows = Array.from({ length: 130 }, (_, i) => row(String(i)));
  rows.push(
    row("expired", { expires_at: "2000-01-01T00:00:00Z" }),
    row("hidden", { category: "messages" }),
  );
  await mount({ categories: ["events"] });
  expect(current.notifications).toHaveLength(100);
  expect(current.unreadCount).toBe(130);
});
it("executes automatic acknowledgements rather than leaving lazy writes unexecuted", async () => {
  mocks.active.mockReturnValue(true);
  await mount();
  expect(rows[0].read).toBe(true);
  expect(current.unreadCount).toBe(0);
  expect(writes).toBe(1);
  const incoming = row("new");
  rows.push(incoming);
  await act(async () => {
    listener({ eventType: "INSERT", new: incoming });
  });
  expect(incoming.read).toBe(true);
  expect(current.unreadCount).toBe(0);
});
it("reports failed and zero-row mutations without pretending they succeeded", async () => {
  await mount();
  fail = true;
  await act(async () => {
    expect(await current.deleteNotification("one")).toBe(false);
  });
  expect(current.unreadCount).toBe(1);
  expect(rows[0].dismissed_at).toBeNull();
  expect(mocks.error).toHaveBeenCalled();
  fail = false;
  await act(async () => {
    expect(await current.markAsRead("missing")).toBe(false);
  });
});
it("upserts preferences and surfaces failed saves without changing the displayed preference", async () => {
  await mount();
  await act(async () => {
    expect(
      await prefs.updatePreference("events", { email_enabled: false }),
    ).toBe(true);
  });
  expect(prefs.getPreference("events")?.email_enabled).toBe(false);
  fail = true;
  await act(async () => {
    expect(
      await prefs.updatePreference("events", { email_enabled: true }),
    ).toBe(false);
  });
  expect(prefs.getPreference("events")?.email_enabled).toBe(false);
  expect(mocks.error).toHaveBeenCalled();
});
it("does not let callbacks from the previous account replace the new account feed", async () => {
  rows.push(row("other", { user_id: "b" }));
  await mount();
  const oldRefetch = current.refetch;
  await act(async () => {
    renderer.update(<Harness user="b" />);
  });
  await act(async () => {
    await oldRefetch();
  });
  expect(current.notifications.map((n) => n.id)).toEqual(["other"]);
  expect(prefs.preferences).toEqual([]);
});
