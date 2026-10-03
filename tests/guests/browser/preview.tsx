import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route, useNavigate, useSearchParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { HelmetProvider } from 'react-helmet-async';
import { Toaster } from 'sonner';
import MyGuests from '@/pages/player/MyGuests';
import ClaimGuest from '@/pages/ClaimGuest';
import { PlayerPickerSheet, type PickerPlayer } from '@/components/round-robin/PlayerPickerSheet';
import { Button } from '@/components/ui/button';
import { signIn } from './stub';
import '../../../src/index.css';
function Picker() {
  const [players, setPlayers] = useState<PickerPlayer[]>([]);
  return <main className="p-6 space-y-4"><h1>Local round-robin guest picker check</h1><PlayerPickerSheet selectedPlayers={players} onPlayersChange={setPlayers} trigger={<Button>Add players</Button>} /><p>Selected: {players.map(p => p.display_name).join(', ') || 'None'}</p></main>;
}
function Auth() {
  const [params] = useSearchParams(); const navigate = useNavigate();
  return <main className="p-6 space-y-4"><h1>Local sign-in simulation</h1><p>Return to {params.get('redirect')}</p><Button onClick={() => { signIn(); navigate(params.get('redirect')!); }}>Complete test sign-in</Button></main>;
}
const params = new URLSearchParams(window.location.search);
createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><HelmetProvider><ThemeProvider attribute="class" defaultTheme="light"><MemoryRouter initialEntries={[params.has('claim') ? '/claim-guest/local-test-token' : params.has('picker') ? '/picker' : '/player/guests']}><Routes>
    <Route path="/player/guests" element={<MyGuests />} /><Route path="/claim-guest/:token" element={<ClaimGuest />} />
    <Route path="/auth" element={<Auth />} /><Route path="/picker" element={<Picker />} />
    <Route path="*" element={<p className="p-6">Local destination reached.</p>} />
  </Routes></MemoryRouter><Toaster /></ThemeProvider></HelmetProvider></QueryClientProvider>,
);
