import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "node:path";

const stub = path.resolve(__dirname, "surfaces-stub.tsx");
export default defineConfig({
  plugins: [react()],
  cacheDir: "node_modules/.vite-league-surfaces",
  optimizeDeps: { entries: ["tests/leagues/browser/surfaces.html"] },
  resolve: {
    alias: [
      ...[
        "hooks/useMyLeagues",
        "hooks/useMyUpcomingLeagueMatches",
        "hooks/useAuthState",
        "integrations/supabase/client",
        "lib/skill/featureFlag",
      ].map((name) => ({ find: `@/${name}`, replacement: stub })),
      { find: /^\.\/useAuthState$/, replacement: stub },
      { find: "@", replacement: path.resolve(__dirname, "../../../src") },
    ],
  },
});
