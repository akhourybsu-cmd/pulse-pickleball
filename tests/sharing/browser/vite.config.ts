import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "node:path";
const stub = path.resolve(__dirname, "stub.tsx");
export default defineConfig({
  plugins: [react()],
  cacheDir: "node_modules/.vite-share-join-qa",
  optimizeDeps: { entries: ["tests/sharing/browser/index.html"] },
  resolve: {
    alias: [
      ...["@/integrations/supabase/client", "@/hooks/useAuthState"].map(
        (find) => ({ find, replacement: stub })
      ),
      { find: "@", replacement: path.resolve(__dirname, "../../../src") },
    ],
  },
});
