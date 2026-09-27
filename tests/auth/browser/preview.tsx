import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { AuthStateProvider, useAuthState } from '../../../src/hooks/useAuthState';
import { AuthGuard } from '../../../src/components/guards/AuthGuard';
import { restoreConnection, resumeSession, resumeOffline, reconnectSession } from './stub';
import '../../../src/index.css';

let formInstance = 0;
function DraftForm() {
  const { user, profile } = useAuthState();
  const [instance] = useState(() => ++formInstance);
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  useEffect(() => { setName(profile?.full_name ?? ''); }, [user, profile]);
  return <form className="max-w-lg space-y-4" onSubmit={event => event.preventDefault()}>
    <p>Form instance: <output>{instance}</output></p>
    <label className="block">Event name<input className="block border p-2 w-full" value={name} onChange={event => setName(event.target.value)} /></label>
    <label className="block">Unfinished notes<textarea className="block border p-2 w-full" value={notes} onChange={event => setNotes(event.target.value)} /></label>
  </form>;
}
function Probe() {
  const auth = useAuthState();
  return <><header className="p-4 space-y-3"><p>Local connection test · no live account</p><button onClick={restoreConnection}>Restore mock connection</button>
    <div className="flex flex-wrap gap-3">
      <button onClick={() => resumeSession()}>Return to app</button>
      <button onClick={() => resumeSession('TOKEN_REFRESHED')}>Renew session token</button>
      <button onClick={resumeOffline}>Return with connection unavailable</button>
      <button onClick={reconnectSession}>Reconnect session</button>
    </div></header>
    <AuthGuard><main className="p-6 space-y-4"><h1>Player information loaded</h1><p>{auth.profile?.full_name}</p><DraftForm /></main></AuthGuard></>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><MemoryRouter><AuthStateProvider><Probe /></AuthStateProvider></MemoryRouter></React.StrictMode>);
