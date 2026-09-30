import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "node:path";
const stub = path.resolve(__dirname, "stub.ts");
export default defineConfig({
  plugins: [react()],
  cacheDir: ".qa-cache/community-vite",
  optimizeDeps: { entries: ["tests/communities/browser/index.html"] },
  resolve: {
    alias: [
      ...[
        "integrations/supabase/client",
        "hooks/useAuthState",
        "hooks/useGroups",
        "hooks/useCommunityDiscovery",
        "hooks/useGroupPosts",
        "hooks/useGroupEvents",
      ].map((name) => ({ find: "@/" + name, replacement: stub })),
      { find: "@", replacement: path.resolve(__dirname, "../../../src") },
    ],
  },
});
