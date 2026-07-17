import { defineConfig } from "vitest/config";
import path from "node:path";

// Slice 3 test runner. Unit tests are pure (no DB / network); the Slice 2a
// integration harness under tests/rr_slice2a auto-skips unless its env vars are
// set, so it is safe to include in the default glob.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.{ts,tsx}", "tests/**/*.{test,spec}.{ts,tsx}"],
  },
});
