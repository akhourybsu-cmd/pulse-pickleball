import React from "react";
import { act, create } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "@/components/ErrorBoundary";

vi.mock("@/lib/assetRecovery", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/assetRecovery")>();
  return { ...actual, recoverStaleAsset: vi.fn().mockResolvedValue(false) };
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("failed route recovery controls", () => {
  it("offers a real page reload for a rejected lazy import", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const reload = vi.fn();
    vi.stubGlobal("window", { location: { reload } });
    const BrokenRoute = () => {
      throw new TypeError(
        "Failed to fetch dynamically imported module: /assets/community-old.js",
      );
    };
    let view!: ReturnType<typeof create>;
    await act(async () => {
      view = create(
        <ErrorBoundary>
          <BrokenRoute />
        </ErrorBoundary>,
      );
    });
    expect(JSON.stringify(view.toJSON())).toContain(
      "This page needs to reload",
    );
    const buttons = view.root.findAllByType("button");
    expect(buttons.map((button) => button.props.children[1])).toEqual([
      "Reload PULSE",
      "Go Home",
    ]);
    await act(async () => {
      buttons[0].props.onClick();
    });
    expect(reload).toHaveBeenCalledOnce();
    view.unmount();
  });

  it("still retries rendering after an ordinary application error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    let broken = true;
    const Route = () => {
      if (broken) throw new Error("Temporary render failure");
      return <p>Recovered content</p>;
    };
    let view!: ReturnType<typeof create>;
    await act(async () => {
      view = create(
        <ErrorBoundary>
          <Route />
        </ErrorBoundary>,
      );
    });
    expect(JSON.stringify(view.toJSON())).toContain("Something went wrong");
    broken = false;
    await act(async () => {
      view.root.findAllByType("button")[0].props.onClick();
    });
    expect(JSON.stringify(view.toJSON())).toContain("Recovered content");
    view.unmount();
  });
});
