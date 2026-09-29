import { describe, expect, it, vi } from "vitest";
import {
  isAssetLoadError,
  recoverStaleAsset,
  type AssetRecoveryRuntime,
} from "./assetRecovery";

const missingModule = new TypeError(
  "Failed to fetch dynamically imported module: https://pulsepb.com/assets/community-old.js",
);
const manifest = {
  schema: 1,
  revision: "a".repeat(40),
  files: {
    "index.html": "b".repeat(64),
    "assets/index-new.js": "c".repeat(64),
  },
};

function runtime(
  overrides: Partial<AssetRecoveryRuntime> = {},
): AssetRecoveryRuntime {
  const values = new Map<string, string>();
  return {
    entryPath: "assets/index-old.js",
    online: true,
    storage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => {
        values.set(key, value);
      },
    },
    now: () => 1_000_000,
    readManifest: vi.fn().mockResolvedValue(manifest),
    reload: vi.fn(),
    ...overrides,
  };
}

describe("stale app recovery", () => {
  it.each([
    missingModule,
    new TypeError("Importing a module script failed."),
    new TypeError("error loading dynamically imported module"),
    new Error("Unable to preload CSS for /assets/events-old.css"),
    new Error("Loading chunk 10 failed."),
    { name: "ChunkLoadError" },
  ])("recognizes a failed route asset: %s", (error) => {
    expect(isAssetLoadError(error)).toBe(true);
  });

  it("reloads an older app once after verifying a newer deployed release", async () => {
    const app = runtime();
    expect(await recoverStaleAsset(missingModule, app)).toBe(true);
    // The guard survives recreating the app runtime after a page reload.
    expect(
      await recoverStaleAsset(
        missingModule,
        runtime({ storage: app.storage, reload: app.reload }),
      ),
    ).toBe(false);
    expect(app.reload).toHaveBeenCalledTimes(1);
  });

  it("does not reload a current app whose route download fails", async () => {
    const app = runtime({ entryPath: "assets/index-new.js" });
    expect(await recoverStaleAsset(missingModule, app)).toBe(false);
    expect(app.reload).not.toHaveBeenCalled();
  });

  it("allows recovery after another deployment outside the cooldown", async () => {
    const app = runtime();
    await recoverStaleAsset(missingModule, app);
    expect(
      await recoverStaleAsset(missingModule, { ...app, now: () => 1_300_000 }),
    ).toBe(true);
    expect(app.reload).toHaveBeenCalledTimes(2);
  });

  it("deduplicates concurrent failures from the same page", async () => {
    const app = runtime();
    expect(
      await Promise.all([
        recoverStaleAsset(missingModule, app),
        recoverStaleAsset(missingModule, app),
      ]),
    ).toEqual([true, false]);
    expect(app.reload).toHaveBeenCalledTimes(1);
  });

  it.each([
    new Error("Failed to fetch"),
    new Error("Database unavailable"),
    null,
    "failed import",
  ])("does not refresh for data or application errors: %s", async (error) => {
    const app = runtime();
    expect(await recoverStaleAsset(error, app)).toBe(false);
    expect(app.readManifest).not.toHaveBeenCalled();
    expect(app.reload).not.toHaveBeenCalled();
  });

  it.each([{ online: false }, { storage: null }])(
    "keeps manual recovery when offline or storage is unavailable",
    async (overrides) => {
      const app = runtime(overrides);
      expect(await recoverStaleAsset(missingModule, app)).toBe(false);
      expect(app.readManifest).not.toHaveBeenCalled();
    },
  );

  it.each([
    null,
    {},
    "<html>fallback</html>",
    { ...manifest, revision: "" },
    { ...manifest, files: {} },
  ])("ignores invalid release responses: %s", async (response) => {
    const app = runtime({ readManifest: vi.fn().mockResolvedValue(response) });
    expect(await recoverStaleAsset(missingModule, app)).toBe(false);
    expect(app.reload).not.toHaveBeenCalled();
  });

  it("keeps manual recovery after release fetch failure", async () => {
    const app = runtime({
      readManifest: vi.fn().mockRejectedValue(new Error("Offline")),
    });
    expect(await recoverStaleAsset(missingModule, app)).toBe(false);
    expect(app.reload).not.toHaveBeenCalled();
  });

  it("requires persisting the guard before attempting a reload", async () => {
    const app = runtime({
      storage: {
        getItem: () => null,
        setItem: () => {
          throw new Error("Storage blocked");
        },
      },
    });
    expect(await recoverStaleAsset(missingModule, app)).toBe(false);
    expect(app.reload).not.toHaveBeenCalled();
  });
});
