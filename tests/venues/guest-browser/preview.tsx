import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PublicCommunityLayout, { CommunityDetailRoute, CommunityDirectoryRoute } from '../../../src/pages/public/PublicCommunityLayout';
import PublicCommunity from '../../../src/pages/public/PublicCommunity';
import JoinGroupByCode from '../../../src/pages/player/JoinGroupByCode';
import Auth from '../../../src/pages/Auth';
import { confirmPreview, previewSignOut } from './stub';
import '../../../src/index.css';
function PreviewAuth() { const location = useLocation(); return <Auth key={location.key} />; }
function Preview() {
  const navigate = useNavigate();
  return <><aside className="flex flex-wrap gap-3 border-b bg-muted p-2 text-xs"><span>Local fixture · no live accounts</span><button onClick={() => { previewSignOut(); navigate('/venues/pickleball-palace'); }}>Reset guest</button><button onClick={() => { const url = new URL(confirmPreview() || 'http://localhost/auth'); navigate(url.pathname + url.search); }}>Confirm preview email</button></aside><Routes>
    <Route element={<PublicCommunityLayout />}><Route path="/player/community/join/:code" element={<JoinGroupByCode />} /><Route path="/venues/:slug" element={<PublicCommunity />} /><Route path="/player/community" element={<CommunityDirectoryRoute />} /><Route path="/player/community/group/:groupId" element={<CommunityDetailRoute />} /></Route>
    <Route path="/auth" element={<PreviewAuth />} />
  </Routes></>;
}
const entry = new URLSearchParams(location.search).get('entry') || '/venues/pickleball-palace';
const query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
createRoot(document.getElementById('root')!).render(<React.StrictMode><QueryClientProvider client={query}><MemoryRouter initialEntries={[entry]}><React.Suspense fallback={<p>Opening preview…</p>}><Preview /></React.Suspense></MemoryRouter></QueryClientProvider></React.StrictMode>);
