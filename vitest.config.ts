import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Vitest config for the Slice 2a round-robin integration suite.
 *
 * These are DB-integration tests: they sign a real user in against a Supabase
 * instance and exercise the `rr_manage_participant` RPC end-to-end (the RPC
 * reads `auth.uid()`, so it cannot be exercised from a migration DO block).
 *
 * The suite auto-skips when the required env vars are absent (see
 * tests/rr_slice2a/harness.ts::readEnv) so it can never mis-target a project.
 * Point it at a LOCAL `supabase start` stack or a disposable project — never
 * production. See tests/rr_slice2a/README.md.
 */
export default defineConfig({
  resolve: {
    // Match the app's "@/*" -> "src/*" path alias (tsconfig paths) so tests
    // can import application modules the same way app code does.
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // Node environment — no jsdom; we talk to Postgres via supabase-js.
    environment: "node",
    // Integration tests hit a real DB and run serially to keep the shared
    // fixture event deterministic (no cross-test row races).
    fileParallelism: false,
    sequence: { concurrent: false },
    include: ["tests/**/*.spec.ts"],
    // Sign-in + seeding + RPC round-trips are slower than unit tests.
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // Load tests/rr_slice2a/.env.test (git-ignored) before the suite.
    setupFiles: ["tests/rr_slice2a/setup.env.ts"],
  },
});
