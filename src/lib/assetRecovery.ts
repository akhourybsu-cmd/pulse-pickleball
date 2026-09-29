const RECOVERY_KEY = "pulse.asset-recovery.v1";
const RECOVERY_COOLDOWN_MS = 5 * 60_000;

/** Only failed code/style downloads qualify; application and data errors do not. */
export function isAssetLoadError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { name, message } = error as { name?: unknown; message?: unknown };
  return (
    name === "ChunkLoadError" ||
    (typeof message === "string" &&
      /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS|Loading (?:CSS )?chunk [\s\S]* failed/i.test(
        message,
      ))
  );
}

export interface AssetRecoveryRuntime {
  entryPath: string;
  online: boolean;
  storage: Pick<Storage, "getItem" | "setItem"> | null;
  now: () => number;
  readManifest: () => Promise<unknown>;
  reload: () => void;
}

function browserRuntime(): AssetRecoveryRuntime | null {
  if (
    typeof window === "undefined" ||
    !/^https?:$/.test(window.location.protocol)
  )
    return null;
  const entry = document.querySelector<HTMLScriptElement>(
    'script[type="module"][src]',
  );
  if (!entry) return null;
  const url = new URL(entry.src, window.location.href);
  if (
    url.origin !== window.location.origin ||
    !/^\/assets\/[^/]+\.js$/.test(url.pathname)
  )
    return null;
  let storage: Storage | null = null;
  try {
    storage = window.sessionStorage;
  } catch {
    /* Manual reload remains available. */
  }
  return {
    entryPath: url.pathname.slice(1),
    online: navigator.onLine,
    storage,
    now: Date.now,
    reload: () => window.location.reload(),
    readManifest: async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetch("/backend-release.json", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Release check unavailable");
        return await response.json();
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

/** Refresh once after a confirmed deployment, preserving the URL and auth storage.
 * The error boundary has already stopped rendering the failed route. Never refresh
 * healthy pages, offline sessions, native bundles, or repeatedly failing builds.
 */
export async function recoverStaleAsset(
  error: unknown,
  runtime = browserRuntime(),
): Promise<boolean> {
  if (!isAssetLoadError(error) || !runtime?.online || !runtime.storage)
    return false;
  try {
    const manifest = (await runtime.readManifest()) as {
      schema?: unknown;
      revision?: unknown;
      files?: Record<string, unknown>;
    } | null;
    if (
      manifest?.schema !== 1 ||
      typeof manifest.revision !== "string" ||
      !/^[a-f0-9]{40}$/.test(manifest.revision) ||
      !manifest.files ||
      typeof manifest.files["index.html"] !== "string" ||
      !/^[a-f0-9]{64}$/.test(manifest.files["index.html"])
    )
      return false;
    // A current entry means this is a connectivity/build problem, not an old tab.
    if (Object.prototype.hasOwnProperty.call(manifest.files, runtime.entryPath))
      return false;
    const now = runtime.now();
    const previous = Number(runtime.storage.getItem(RECOVERY_KEY));
    if (previous > 0 && now - previous < RECOVERY_COOLDOWN_MS) return false;
    // Persist BEFORE reloading. If storage is blocked, do not risk a reload loop.
    runtime.storage.setItem(RECOVERY_KEY, String(now));
    runtime.reload();
    return true;
  } catch {
    return false;
  }
}
