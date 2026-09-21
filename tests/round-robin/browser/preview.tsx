import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route, Link } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { WizardContainer } from '../../../src/components/round-robin/wizard/WizardContainer';
import { writes } from './stub';
import '../../../src/index.css';
const params = new URLSearchParams(window.location.search);
if (params.has('dark')) document.documentElement.classList.add('dark');
if (params.has('large-text')) document.documentElement.style.fontSize = '20px';
const query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
function Complete() {
 return <main className="max-w-3xl mx-auto p-8"><h1 className="text-3xl">Preview event created</h1><p className="my-4">Local fixtures only. No data was sent to a server.</p><pre className="overflow-auto rounded-xl border p-4 text-xs">{JSON.stringify(writes, null, 2)}</pre><Link to="/">Start another preview</Link></main>;
}
createRoot(document.getElementById('root')!).render(<MemoryRouter initialEntries={[`/${params.has('group') ? '?groupId=group-one' : ''}`]}><QueryClientProvider client={query}><Routes><Route path="/" element={<WizardContainer />} /><Route path="/round-robin/:id" element={<Complete />} /><Route path="*" element={<Link to="/">Return to the creation preview</Link>} /></Routes><Toaster /></QueryClientProvider></MemoryRouter>);
