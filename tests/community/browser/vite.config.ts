import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "node:path";
const stub = path.resolve(__dirname, "stub.tsx");
export default defineConfig({
  plugins: [react()],
  cacheDir: ".qa-cache/community-vite",
  optimizeDeps: { entries: ["tests/community/browser/index.html"] },
  resolve: {
    alias: [
      ...[
        "integrations/supabase/client",
        "hooks/useAuthState",
        "hooks/useGroupDetail",
        "hooks/useGroupPosts",
        "hooks/useGroupEvents",
        "hooks/useGroupFiles",
        "hooks/useGroupMembers",
        "hooks/useGroupPresence",
        "hooks/useGroupRealtime",
        "hooks/useGroupSettings",
        "hooks/useGroupChat",
        "hooks/useTypingIndicator",
        "hooks/useFriends",
        "hooks/useDirectMessages",
        "hooks/useGroupPostComments",
      ].map((name) => ({ find: `@/${name}`, replacement: stub })),
      { find: "@", replacement: path.resolve(__dirname, "../../../src") },
    ],
  },
});
