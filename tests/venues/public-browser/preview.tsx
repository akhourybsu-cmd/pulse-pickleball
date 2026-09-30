import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PublicCommunity from '@/pages/public/PublicCommunity';
import PublicCommunityLayout from '@/pages/public/PublicCommunityLayout';
import '@/index.css';
function AuthDestination() { const location = useLocation(); return <main className="p-6"><h1>Local sign-in destination</h1><p className="break-all">{location.search}</p><p>No real authentication or writes in this fixture.</p></main>; }
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={['/venues/palace']}><p className="p-2 text-center text-xs">LOCAL QA · NO LIVE WRITES</p><Routes><Route element={<PublicCommunityLayout />}><Route path="/venues/:slug" element={<PublicCommunity />} /></Route><Route path="/auth" element={<AuthDestination />} /></Routes></MemoryRouter></QueryClientProvider>);
