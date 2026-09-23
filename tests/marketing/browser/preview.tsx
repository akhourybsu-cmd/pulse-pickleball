import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { ThemeProvider } from 'next-themes';
import { PublicHomepage } from '../../../src/components/homepage/PublicHomepage';
import PlayerLeagueDetail from '../../../src/pages/player/PlayerLeagueDetail';
import '../../../src/index.css';
import '../../../src/components/homepage/marketing.css';

const params = new URLSearchParams(window.location.search);
createRoot(document.getElementById('root')!).render(<ThemeProvider attribute="class" forcedTheme={params.has('dark') ? 'dark' : 'light'}><HelmetProvider><MemoryRouter initialEntries={[params.has('league') ? '/player/leagues/demo-league' : '/']}><Routes><Route path="/" element={<PublicHomepage />} /><Route path="/player/leagues/:leagueId" element={<PlayerLeagueDetail />} /><Route path="*" element={<p>Local preview destination reached.</p>} /></Routes></MemoryRouter></HelmetProvider></ThemeProvider>);
