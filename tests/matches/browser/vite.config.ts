import { defineConfig } from "vite";
import path from "node:path";
import marketing from "../../marketing/browser/vite.config";
export default defineConfig({
  ...marketing,
  cacheDir: "node_modules/.vite-matches-qa",
  optimizeDeps: { entries: ["tests/matches/browser/index.html"] },
  resolve: {
    alias: [
      {
        find: "@/hooks/useMatchHistory",
        replacement: path.resolve(__dirname, "fixture.ts"),
      },
      ...marketing.resolve.alias,
    ],
  },
});
