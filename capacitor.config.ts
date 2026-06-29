import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor config.
 *
 * IMPORTANT (production / store builds):
 * Do NOT set `server.url` for release builds. When `server.url` is set, the
 * native app loads JS from that remote URL on every cold start — that means
 * a network round-trip to Lovable's preview origin before the user sees
 * anything, and the app cannot launch offline. For Google Play / App Store
 * builds we ship the bundled `dist/` so cold start is instant.
 *
 * For live-reload during local development only, you can temporarily
 * re-add the `server` block:
 *   server: {
 *     url: 'https://ca6dbc43-755e-43df-a1af-7527a749b225.lovableproject.com?forceHideBadge=true',
 *     cleartext: true,
 *   }
 * Remove it again before `npx cap sync` for a release build.
 */
const config: CapacitorConfig = {
  appId: 'app.lovable.ca6dbc43755e43dfa1af7527a749b225',
  appName: 'PULSE - Pickleball Rating System',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      launchAutoHide: true,
      backgroundColor: '#1B1D21',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;
