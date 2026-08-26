import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // In production, strip debug logging (console.log/debug/info) and any stray
  // `debugger` statements. console.warn/error are kept so real problems still
  // surface in the field.
  esbuild: {
    pure: mode === "production" ? ["console.log", "console.debug", "console.info"] : [],
    drop: mode === "production" ? ["debugger"] : [],
  },
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    sourcemap: false,
    // NOTE: no `manualChunks`. Hand-naming vendor chunks (vendor-react,
    // vendor-radix, …) left shared transitive deps (react-router internals,
    // radix helpers) in the entry chunk, which created a chunk cycle:
    // vendor-react -> index -> vendor-radix. Browsers then executed
    // vendor-radix first, where `React` was still undefined —
    // "Cannot read properties of undefined (reading 'forwardRef')" and a
    // blank page in production. Rollup's default chunking derives a
    // cycle-free order automatically and still keeps lazy routes (and
    // recharts) out of the boot graph.
  }


}));
