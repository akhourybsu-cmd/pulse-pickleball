import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import RoundRobinDetail from '../../../src/pages/RoundRobinDetail';
import '../../../src/index.css';
const params = new URLSearchParams(window.location.search);
const query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
createRoot(document.getElementById('root')!).render(
  <ThemeProvider attribute="class" forcedTheme={params.has('dark') ? 'dark' : 'light'}>
    <MemoryRouter initialEntries={['/round-robin/preview-event']}>
      <QueryClientProvider client={query}><Routes>
        <Route path="/round-robin/:id" element={<RoundRobinDetail />} />
        <Route path="*" element={<p className="p-8">Local preview navigation complete. Reload to return.</p>} />
      </Routes><Toaster /></QueryClientProvider>
    </MemoryRouter>
  </ThemeProvider>
);
