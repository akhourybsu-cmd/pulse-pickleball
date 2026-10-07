import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, expect, it, vi } from "vitest";
import { useRoundRobinAction } from "@/hooks/useRoundRobinAction";

let root: ReactTestRenderer;
let actions: ReturnType<typeof useRoundRobinAction>;
function Host() {
  actions = useRoundRobinAction();
  return <output>{actions.label}</output>;
}
const mount = () =>
  act(() => {
    root = create(<Host />);
  });
afterEach(() => act(() => root?.unmount()));

it("blocks repeated and conflicting host writes before the busy render, through completion", async () => {
  mount();
  let finish!: () => void;
  const save = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      })
  );
  const rebuild = vi.fn(async () => {});
  const scoreClick = actions.guardClick("Saving score…", save);
  const rebuildClick = actions.guardClick("Rebuilding…", rebuild);
  let pending!: Promise<void>;
  await act(async () => {
    pending = scoreClick();
    void scoreClick();
    void rebuildClick();
  });
  expect(save).toHaveBeenCalledTimes(1);
  expect(rebuild).not.toHaveBeenCalled();
  expect(root.root.findByType("output").children).toEqual(["Saving score…"]);
  await expect(actions.guard("Replacing player…", rebuild)()).rejects.toThrow(
    "still running"
  );
  expect(rebuild).not.toHaveBeenCalled();
  await act(async () => {
    finish();
    await pending;
  });
  await act(async () => rebuildClick());
  expect(rebuild).toHaveBeenCalledTimes(1);
  expect(root.root.findByType("output").children).toEqual([]);
});

it("unlocks after a rejected mutation and returns the retry result without claiming success", async () => {
  mount();
  const work = vi
    .fn()
    .mockRejectedValueOnce(new Error("Schedule changed elsewhere"))
    .mockResolvedValueOnce(2);
  const add = actions.guard("Adding players…", work);
  await act(async () => {
    await expect(add()).rejects.toThrow("Schedule changed elsewhere");
  });
  expect(actions.label).toBeNull();
  await act(async () => {
    expect(await add()).toBe(2);
  });
  expect(work).toHaveBeenCalledTimes(2);
  expect(actions.label).toBeNull();
});

it("keeps other actions locked while a departure awaits a live-match decision, then releases on cancel", async () => {
  mount();
  let cancel!: (value: boolean) => void;
  const remove = actions.guard(
    "Updating roster…",
    () =>
      new Promise<boolean>((resolve) => {
        cancel = resolve;
      })
  );
  const complete = vi.fn(async () => {});
  let pending!: Promise<boolean>;
  await act(async () => {
    pending = remove();
  });
  await act(async () => actions.guardClick("Completing…", complete)());
  expect(complete).not.toHaveBeenCalled();
  await act(async () => {
    cancel(false);
    expect(await pending).toBe(false);
  });
  await act(async () => actions.guardClick("Completing…", complete)());
  expect(complete).toHaveBeenCalledTimes(1);
});
