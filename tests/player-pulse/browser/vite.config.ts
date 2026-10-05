import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "node:path";
const stub = path.resolve(__dirname, "stub.ts");
export default defineConfig({
  plugins: [react()],
  cacheDir: "node_modules/.vite-pulse-qa",
  optimizeDeps: { entries: ["tests/player-pulse/browser/index.html"] },
  resolve: {
    alias: [
      { find: "@/hooks/usePlayerPulse", replacement: stub },
      { find: "@/hooks/useAuthState", replacement: stub },
      { find: "@", replacement: path.resolve(__dirname, "../../../src") },
    ],
  },
});
