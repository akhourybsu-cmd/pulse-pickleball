import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

const workerSource = readFileSync(
  new URL("../public/sw.js", import.meta.url),
  "utf8",
);

function response(mime: string, options = {}) {
  return {
    ok: true,
    type: "basic",
    redirected: false,
    headers: new Headers({ "content-type": mime }),
    clone() {
      return this;
    },
    ...options,
  };
}

function worker(
  cached?: ReturnType<typeof response>,
  network = response("application/javascript"),
) {
  const handlers = new Map<string, (event: any) => void>();
  const cache = {
    match: vi.fn().mockResolvedValue(cached),
    delete: vi.fn().mockResolvedValue(true),
    put: vi.fn().mockResolvedValue(undefined),
  };
  const caches = {
    open: vi.fn().mockResolvedValue(cache),
    keys: vi
      .fn()
      .mockResolvedValue([
        "pulse-previous-release",
        "pulse-v8-fast-refresh",
        "other-app",
      ]),
    delete: vi.fn().mockResolvedValue(true),
  };
  const fetch = vi.fn().mockResolvedValue(network);
  runInNewContext(workerSource, {
    self: {
      location: { origin: "https://pulsepb.com" },
      addEventListener: (name: string, handler: (event: any) => void) =>
        handlers.set(name, handler),
      clients: { claim: vi.fn() },
    },
    caches,
    fetch,
    URL,
  });
  return {
    cache,
    caches,
    fetch,
    async request(path = "/assets/community-old.js", options = {}) {
      const request = {
        url: new URL(path, "https://pulsepb.com").href,
        method: "GET",
        mode: "cors",
        ...options,
      };
      let pending: Promise<unknown> | undefined;
      handlers.get("fetch")!({
        request,
        respondWith: (value: Promise<unknown>) => {
          pending = value;
        },
      });
      return { result: await pending, intercepted: !!pending, request };
    },
    async activate() {
      let pending: Promise<unknown> | undefined;
      handlers.get("activate")!({
        waitUntil: (value: Promise<unknown>) => {
          pending = value;
        },
      });
      await pending;
    },
  };
}

describe("service worker route asset recovery", () => {
  it("serves valid cached JavaScript without a network request", async () => {
    const cached = response("text/javascript; charset=utf-8");
    const app = worker(cached);
    expect((await app.request()).result).toBe(cached);
    expect(app.fetch).not.toHaveBeenCalled();
  });

  it("removes cached SPA fallback HTML and bypasses the HTTP cache when retrying", async () => {
    const app = worker(response("text/html"));
    const { request } = await app.request();
    expect(app.cache.delete).toHaveBeenCalledWith(request);
    expect(app.fetch).toHaveBeenCalledWith(request, { cache: "reload" });
    expect(app.cache.put).toHaveBeenCalledOnce();
  });

  it.each([
    response("text/html"),
    response("application/json"),
    response("application/javascript", { ok: false }),
    response("application/javascript", { redirected: true }),
    response("application/javascript", { type: "opaque" }),
  ])("does not cache an invalid JavaScript response", async (network) => {
    const app = worker(undefined, network);
    expect((await app.request()).result).toBe(network);
    expect(app.cache.put).not.toHaveBeenCalled();
  });

  it("caches successful CSS while rejecting HTML at a CSS URL", async () => {
    const app = worker(undefined, response("text/css"));
    await app.request("/assets/app.css");
    expect(app.cache.put).toHaveBeenCalledOnce();
    const broken = worker(undefined, response("text/html"));
    await broken.request("/assets/app.css");
    expect(broken.cache.put).not.toHaveBeenCalled();
  });

  it.each([
    "/backend-release.json",
    "/~oauth/callback",
    "/auth/v1/token",
    "https://project.supabase.co/rest/v1/events",
  ])("leaves release, auth and database requests alone: %s", async (path) => {
    const app = worker();
    expect((await app.request(path)).intercepted).toBe(false);
    expect(app.caches.open).not.toHaveBeenCalled();
    expect(app.fetch).not.toHaveBeenCalled();
  });

  it("fetches navigations from the network instead of serving cached app HTML", async () => {
    const app = worker(response("text/html"));
    const { request } = await app.request("/player/community", {
      mode: "navigate",
    });
    expect(app.fetch).toHaveBeenCalledWith(request);
    expect(app.cache.match).not.toHaveBeenCalled();
  });

  it("only removes obsolete PULSE caches on activation", async () => {
    const app = worker();
    await app.activate();
    expect(app.caches.delete).toHaveBeenCalledExactlyOnceWith(
      "pulse-previous-release",
    );
  });
});
