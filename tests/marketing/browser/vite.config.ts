import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'node:path';
const fixture = path.resolve(__dirname, 'leagueFixture.ts');
const socialFixture = path.resolve(__dirname, 'socialFixture.ts');
export default defineConfig({
  plugins: [react(), {
    name: 'marketing-fixture-at-root',
    configureServer(server) {
      server.middlewares.use((request, _response, next) => {
        if (request.url?.split('?')[0] === '/') request.url = `/tests/marketing/browser/index.html${request.url.slice(1)}`;
        next();
      });
    },
  }], cacheDir: 'node_modules/.vite-marketing-qa',
  define: { 'import.meta.env.VITE_SKILL_ASSESSMENT': JSON.stringify('on') },
  optimizeDeps: { entries: ['tests/marketing/browser/index.html'] },
  resolve: { alias: [
    { find: '@/hooks/useLeagueDetailForPlayer', replacement: fixture },
    ...['integrations/supabase/client', 'hooks/useAuthState', 'hooks/useFriends', 'hooks/useFriendsPresence', 'hooks/useFriendSuggestions', 'hooks/useGroups', 'hooks/useDirectMessages', 'hooks/useTypingIndicator', 'hooks/useMessagingSafety', 'hooks/useNotifications', 'hooks/usePushSubscription', 'hooks/useMyLeagues', 'hooks/useMyUpcomingLeagueMatches', 'hooks/useDiscoverEvents', 'lib/roundRobin/userEvents'].map(name => ({ find: `@/${name}`, replacement: socialFixture })),
    { find: '@', replacement: path.resolve(__dirname, '../../../src') },
  ] },
});
