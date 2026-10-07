import React, { Profiler } from 'react';
import { installPerformancePanel, recordRender } from './performance';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import RoundRobinDetail from '../../../src/pages/RoundRobinDetail';
import RoundRobinKiosk from '../../../src/pages/RoundRobinKiosk';
import '../../../src/index.css';
import '../../marketing/browser/capture.css';
import { advancePreviewRound, hidePreviewEvent, togglePreviewConnection } from './stub';
const params = new URLSearchParams(window.location.search);
if (params.has('capture')) document.documentElement.classList.add('product-capture');
const query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
installPerformancePanel();
createRoot(document.getElementById('root')!).render(
  <Profiler id="round-robin" onRender={recordRender}>
  <ThemeProvider attribute="class" forcedTheme={params.has('dark') ? 'dark' : 'light'}>
    <MemoryRouter initialEntries={[`/round-robin/preview-event${params.has('kiosk') ? '/kiosk' : ''}`]}>
      <QueryClientProvider client={query}><Routes>
        <Route path="/round-robin/:id" element={<RoundRobinDetail />} />
        <Route path="/round-robin/:id/kiosk" element={<RoundRobinKiosk />} />
        <Route path="*" element={<p className="p-8">Local preview navigation complete. Reload to return.</p>} />
      </Routes>{params.has('simulate') && <div className="fixed bottom-0 left-0 z-[100] bg-primary text-primary-foreground p-2 text-xs flex gap-4"><button onClick={advancePreviewRound}>Advance preview round</button><button onClick={togglePreviewConnection}>Toggle preview connection</button><button onClick={hidePreviewEvent}>Hide preview event</button></div>}<Toaster /></QueryClientProvider>
    </MemoryRouter>
  </ThemeProvider></Profiler>
);
