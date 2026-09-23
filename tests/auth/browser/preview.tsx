import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { AuthStateProvider, useAuthState } from '../../../src/hooks/useAuthState';
import { AuthGuard } from '../../../src/components/guards/AuthGuard';
import { restoreConnection } from './stub';
import '../../../src/index.css';

function Probe() {
  const auth = useAuthState();
  return <><header className="p-4"><p>Local connection test · no live account</p><button onClick={restoreConnection}>Restore mock connection</button></header>
    <AuthGuard><main className="p-6"><h1>Player information loaded</h1><p>{auth.profile?.full_name}</p></main></AuthGuard></>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><MemoryRouter><AuthStateProvider><Probe /></AuthStateProvider></MemoryRouter></React.StrictMode>);
