import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { ThemeProvider } from 'next-themes';
import { PublicHomepage } from '../../../src/components/homepage/PublicHomepage';
import PlayerLeagueDetail from '../../../src/pages/player/PlayerLeagueDetail';
import Dashboard from '../../../src/pages/Dashboard';
import Friends from '../../../src/pages/player/Friends';
import DirectMessageChat from '../../../src/pages/player/DirectMessageChat';
import Community from '../../../src/pages/player/Community';
import PlayerProfile from '../../../src/pages/player/PlayerProfile';
import { PlayerShell } from '../../../src/components/layout/PlayerShell';
import { ActiveViewProvider } from '../../../src/contexts/ActiveViewContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../../../src/index.css';
import '../../../src/components/homepage/marketing.css';
import './capture.css';

const params = new URLSearchParams(window.location.search);
if (params.has('capture')) document.documentElement.classList.add('product-capture');
const destinations: Record<string, string> = { 'app-home': '/player/dashboard', friends: '/player/friends', chat: '/player/messages/demo-chat', communities: '/player/community', profile: '/player/profile' };
const route = params.has('league') ? '/player/leagues/demo-league' : destinations[params.get('screen') ?? ''] ?? '/';
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={client}><ThemeProvider attribute="class" forcedTheme={params.has('dark') ? 'dark' : 'light'}><HelmetProvider><MemoryRouter initialEntries={[route + window.location.hash]}><ActiveViewProvider><Routes>
  <Route path="/" element={<PublicHomepage />} />
  <Route element={<PlayerShell />}>
    <Route path="/player/leagues/:leagueId" element={<PlayerLeagueDetail />} />
    <Route path="/player/dashboard" element={<Dashboard />} />
    <Route path="/player/friends" element={<Friends />} />
    <Route path="/player/messages/:conversationId" element={<DirectMessageChat />} />
    <Route path="/player/community" element={<Community />} />
    <Route path="/player/profile" element={<PlayerProfile />} />
  </Route>
  <Route path="*" element={<p>Local preview destination reached.</p>} />
</Routes></ActiveViewProvider></MemoryRouter></HelmetProvider></ThemeProvider></QueryClientProvider>);
