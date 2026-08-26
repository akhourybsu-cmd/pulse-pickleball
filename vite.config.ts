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
    rollupOptions: {
      output: {
        // Anything named here becomes part of the entry's STATIC graph and is
        // modulepreloaded in index.html at boot — regardless of whether the
        // code that imports it is lazy. So this list must contain only vendors
        // the app shell genuinely needs on first paint. Grouping them keeps
        // them in stable, separately-cacheable chunks across deploys.
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return;
          // NOTE: recharts is deliberately NOT given a manual chunk. Any
          // module named here is pulled into the entry's static graph and
          // modulepreloaded at boot — which was shipping ~110KB gzip of
          // charting code to every cold start even though its only importers
          // (PlayerPulse -> PulseTrendChart, AdminBiometrics) are lazy routes.
          // Left unnamed, Rollup keeps it in the dynamic chunk of whichever
          // lazy route needs it, so it loads with that screen instead.
          if (/node_modules\/(react|react-dom|react-router|react-router-dom)\//.test(id)) return 'vendor-react';
          if (id.includes('node_modules/@tanstack/')) return 'vendor-query';
          if (id.includes('node_modules/framer-motion/')) return 'vendor-motion';
          if (id.includes('node_modules/@supabase/')) return 'vendor-supabase';
          if (id.includes('node_modules/date-fns/')) return 'vendor-date';
          if (id.includes('node_modules/@radix-ui/')) return 'vendor-radix';
          if (id.includes('node_modules/lucide-react/')) return 'vendor-icons';
        }
      }
    }
  }

}));
