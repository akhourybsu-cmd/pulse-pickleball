import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Drift guard (Slice 2b): the Deno edge function cannot import from `src/`, so
 * the pure planner is duplicated into `supabase/functions/_shared/roundRobin/`.
 * These assertions fail loudly the moment the two copies diverge, so a future
 * edit to the canonical `src` planner can never silently leave the edge
 * function running stale scheduling logic.
 *
 * The ONLY permitted difference is the import specifier: Deno requires an
 * explicit `.ts` extension, the Vite/TS bundler omits it.
 */

const root = path.resolve(__dirname, "../../..");
const srcDir = path.join(root, "src/lib/roundRobin");
const sharedDir = path.join(root, "supabase/functions/_shared/roundRobin");

function read(file: string): string {
  return readFileSync(file, "utf8");
}

/** Normalize the Deno `.ts` import extension so the bodies compare equal. */
function normalize(content: string): string {
  return content.replace(/from "(\.\/[^"]+)\.ts"/g, 'from "$1"');
}

describe("edge-function shared planner drift guard", () => {
  it("scheduleCore.ts is identical in src and the shared edge copy", () => {
    const srcContent = normalize(read(path.join(srcDir, "scheduleCore.ts")));
    const sharedContent = normalize(read(path.join(sharedDir, "scheduleCore.ts")));
    expect(sharedContent).toBe(srcContent);
  });

  it("scoreRemainingSchedule.ts is identical in src and the shared edge copy (modulo import extension)", () => {
    const srcContent = normalize(read(path.join(srcDir, "scoreRemainingSchedule.ts")));
    const sharedContent = normalize(read(path.join(sharedDir, "scoreRemainingSchedule.ts")));
    expect(sharedContent).toBe(srcContent);
  });
});
