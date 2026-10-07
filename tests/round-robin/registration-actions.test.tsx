import React from "react";
import {
  act,
  create,
  type ReactTestInstance,
  type ReactTestRenderer,
} from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { RegistrationManagement } from "@/components/round-robin/RegistrationManagement";

const mocks = vi.hoisted(() => ({
  write: vi.fn(),
  refresh: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.success, error: mocks.error },
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: [
      {
        id: "confirmed",
        registration_status: "confirmed",
        joined_at: "2026-10-07T10:00:00Z",
        profiles: { full_name: "Alex" },
      },
      {
        id: "waitlisted",
        registration_status: "waitlisted",
        joined_at: "2026-10-07T10:01:00Z",
        profiles: { full_name: "Jamie" },
      },
    ],
    refetch: mocks.refresh,
  }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => {
      const chain = {
        delete: () => chain,
        update: () => chain,
        eq: () => chain,
        then: (
          resolve: (value: unknown) => unknown,
          reject: (error: unknown) => unknown
        ) => mocks.write().then(resolve, reject),
      };
      return chain;
    },
  },
}));
vi.mock("@/components/ui/alert-dialog", () => {
  const Box = ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  );
  const Btn = (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props} />
  );
  return {
    AlertDialog: ({
      open,
      onOpenChange,
      children,
    }: {
      open: boolean;
      onOpenChange: (open: boolean) => void;
      children: React.ReactNode;
    }) =>
      open ? (
        <section>
          <button onClick={() => onOpenChange(false)}>Dismiss</button>
          {children}
        </section>
      ) : null,
    AlertDialogContent: Box,
    AlertDialogHeader: Box,
    AlertDialogTitle: Box,
    AlertDialogDescription: Box,
    AlertDialogFooter: Box,
    AlertDialogAction: Btn,
    AlertDialogCancel: Btn,
  };
});
let root: ReactTestRenderer;
const text = (node: ReactTestInstance | string): string =>
  typeof node === "string" ? node : node.children.map(text).join("");
const button = (label: string) =>
  root.root
    .findAllByType("button")
    .find(
      (node) => node.props["aria-label"] === label || text(node) === label
    )!;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.refresh.mockResolvedValue({});
});
afterEach(() => act(() => root?.unmount()));
async function mount() {
  await act(async () => {
    root = create(
      <RegistrationManagement
        eventId="event"
        maxPlayers={8}
        registrationDeadline="2099-01-01T00:00:00Z"
        isOrganizer
      />
    );
  });
}

it("holds removal confirmation through a delayed failure, blocks repeat writes, and retries in place", async () => {
  let finish!: (value: unknown) => void;
  mocks.write.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  await mount();
  await act(async () => button("Remove Alex").props.onClick());
  const click = button("Remove").props.onClick;
  const preventDefault = vi.fn();
  await act(async () => {
    click({ preventDefault });
    click({ preventDefault });
  });
  expect(mocks.write).toHaveBeenCalledTimes(1);
  expect(preventDefault).toHaveBeenCalled();
  expect(button("Removing…").props.disabled).toBe(true);
  expect(button("Cancel").props.disabled).toBe(true);
  expect(button("Confirm Jamie").props.disabled).toBe(true);
  await act(async () => button("Dismiss").props.onClick());
  expect(button("Removing…")).toBeDefined();
  await act(async () => finish({ error: new Error("Connection interrupted") }));
  expect(mocks.success).not.toHaveBeenCalled();
  expect(button("Remove").props.disabled).toBe(false);
  await act(async () => button("Remove").props.onClick({ preventDefault }));
  await act(async () => finish({ error: null }));
  expect(mocks.write).toHaveBeenCalledTimes(2);
  expect(mocks.refresh).toHaveBeenCalledTimes(1);
  expect(button("Dismiss")).toBeUndefined();
});

it("locks promotions until the refreshed roster arrives, including repeated same-frame clicks", async () => {
  let finish!: (value: unknown) => void;
  let refreshed!: () => void;
  mocks.write.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  mocks.refresh.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        refreshed = resolve;
      })
  );
  await mount();
  const click = button("Confirm Jamie").props.onClick;
  await act(async () => {
    click();
    click();
  });
  expect(mocks.write).toHaveBeenCalledTimes(1);
  expect(button("Confirm Jamie").props["aria-busy"]).toBe(true);
  expect(button("Remove Alex").props.disabled).toBe(true);
  await act(async () => finish({ error: null }));
  expect(button("Confirm Jamie").props.disabled).toBe(true);
  await act(async () => refreshed());
  expect(button("Confirm Jamie").props.disabled).toBe(false);
});
