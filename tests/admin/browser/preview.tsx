import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import AdminDashboard from '../../../src/pages/AdminDashboard';
import AdminVenues from '../../../src/pages/AdminVenues';
import AdminVenueRequests from '../../../src/pages/AdminVenueRequests';
import AdminPlatformActivity from '../../../src/pages/AdminPlatformActivity';
import AdminArchive from '../../../src/pages/admin/AdminArchive';
import '../../../src/index.css';
const params=new URLSearchParams(location.search);
if(params.has('large-text'))document.documentElement.style.fontSize='20px';
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><ThemeProvider attribute="class" defaultTheme="light"><MemoryRouter initialEntries={[params.get('page')||'/admin']}><Routes><Route path="/admin" element={<AdminDashboard/>}/><Route path="/admin/venues" element={<AdminVenues/>}/><Route path="/admin/venue-requests" element={<AdminVenueRequests/>}/><Route path="/admin/activity" element={<AdminPlatformActivity/>}/><Route path="/archive" element={<AdminArchive/>}/></Routes><Toaster/></MemoryRouter></ThemeProvider></QueryClientProvider>);

