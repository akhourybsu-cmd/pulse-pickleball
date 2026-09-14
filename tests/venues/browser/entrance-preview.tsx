import React, { useState } from 'react';
import { VenueEntrance, VenueLoadingScreen } from '../../../src/components/venue/VenueEntrance';
import { AdminVenueTab } from '../../../src/components/community/admin/AdminVenueTab';
import palaceLogo from '../../../src/assets/pickleball-palace-logo.png';
import citiLogo from '../../../src/assets/pickleball-citi-logo.png';

export function EntrancePreview() {
  const params = new URLSearchParams(window.location.search);
  const [second, setSecond] = useState(false);
  const [run, setRun] = useState(0);
  const [tab, setTab] = useState('Home');
  const [failed, setFailed] = useState(false);
  const identity = { name: params.has('long-name') ? 'PickleballPalaceChampionshipCourtsAndCommunity' : second ? 'Pickleball Citi' : 'Pickleball Palace', logoUrl: params.has('no-logo') ? null : params.has('broken-logo') ? '/missing-venue-logo.png' : second ? citiLogo : palaceLogo, logoShape: 'circle' as const, logoImageFit: 'contain' as const, primaryColor: second ? '#599ac5' : '#c9962f', secondaryColor: '#183936' };
  const mode = params.get('entrance');
  if (mode === 'screen') return <VenueLoadingScreen identity={identity} />;
  if (mode === 'admin') return <div className="mx-auto max-w-3xl p-3 sm:p-6"><AdminVenueTab groupId="local-group" venueId="local-sample" isVerified mode="profile" /></div>;
  return <VenueEntrance key={`${second}:${run}`} identity={identity} pending={mode === 'slow'} bypass={failed}>
    <div className="mx-auto max-w-2xl space-y-5 p-5">
      <p>LOCAL ENTRANCE QA · NO BACKEND WRITES</p><h1 className="text-2xl font-semibold">{identity.name} · {tab}</h1>
      <div className="flex flex-wrap gap-3">{[
        ['Replay entrance', () => setRun(value => value + 1)],
        ['Change venue', () => setSecond(value => !value)],
        ['Open Chat', () => setTab('Chat')],
        ['Show loading error', () => setFailed(true)],
      ].map(([label, click]) => <button key={String(label)} className="min-h-11 rounded-xl border px-4" onClick={click as () => void}>{String(label)}</button>)}</div>
      {failed && <p role="alert">Feature access could not load. Open community or retry.</p>}
    </div>
  </VenueEntrance>;
}
