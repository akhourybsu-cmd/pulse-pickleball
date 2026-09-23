import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Link, MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { Toaster } from 'sonner';
import SelfAssessment from '../../../src/pages/player/SelfAssessment';
import GuestSkillAssessment from '../../../src/pages/GuestSkillAssessment';
import Auth from '../../../src/pages/Auth';
import PickleballGuide from '../../../src/pages/PickleballGuide';
import { PublicHomepage } from '../../../src/components/homepage/PublicHomepage';
import { AssessmentQuestion } from '../../../src/components/skill/AssessmentQuestion';
import { QUESTION_BANK_V2 } from '../../../src/lib/skill/questionBankV2';
import { AuthStateProvider } from '../../../src/hooks/useAuthState';
import { failNextSave, resetPreview, seedReady, seedUnknown, seedGuest, signInPreview, signOutPreview, enablePreviewMfa, setPreviewStall, type PreviewStall } from './stub';
import '../../../src/index.css';
import '../../../src/components/homepage/marketing.css';
function RememberRoute() { const loc = useLocation(); useEffect(() => { localStorage.setItem('skill-preview-route', loc.pathname + loc.search); }, [loc]); return null; }
export default function Preview() {
  const capture = new URLSearchParams(window.location.search).has('capture');
  const [width, setWidth] = useState('100%');
  const [scene, setScene] = useState('flow');
  return <HelmetProvider><MemoryRouter initialEntries={[capture ? '/skill-assessment' : localStorage.getItem('skill-preview-route') ?? '/skill-assessment']}><RememberRoute /><div className="min-h-screen bg-background text-foreground">
    <header hidden={capture} className={capture ? 'hidden' : 'flex flex-wrap items-center gap-2 border-b bg-card p-3 text-xs'}>
      <strong className="mr-2">PULSE · Local preview</strong>
      <Link className="min-h-10 rounded border p-3" to="/skill-assessment">Guest flow</Link>
      <Link className="min-h-10 rounded border p-3" to="/player/self-assessment">Account flow</Link>
      <Link className="min-h-10 rounded border p-3" to="/">Homepage</Link>
      <button className="min-h-10 rounded border px-3" onClick={signInPreview}>Simulate sign-in</button>
      <button className="min-h-10 rounded border px-3" onClick={signOutPreview}>Simulate sign-out</button>
      <button className="min-h-10 rounded border px-3" onClick={enablePreviewMfa}>Require mock email MFA</button>
      <button className="min-h-10 rounded border px-3" onClick={() => setWidth('390px')}>Phone width</button>
      <button className="min-h-10 rounded border px-3" onClick={() => setWidth('100%')}>Full width</button>
      <button className="min-h-10 rounded border px-3" onClick={failNextSave}>Fail next save</button>
      <label>Stall request <select aria-label="Stall request" className="min-h-10 border bg-background" defaultValue={sessionStorage.getItem('skill-preview-stall') ?? 'none'} onChange={e => setPreviewStall(e.target.value as PreviewStall)}>
        <option value="none">None</option><option value="load">Report load</option><option value="answer">Answer save</option><option value="activity">Activity metadata</option><option value="finalize">Result save</option>
      </select></label>
      <button className="min-h-10 rounded border px-3" onClick={seedReady}>Seed completed questions</button>
      <button className="min-h-10 rounded border px-3" onClick={seedGuest}>Seed guest questions</button>
      <button className="min-h-10 rounded border px-3" onClick={seedUnknown}>Seed unsure questions</button>
      <button className="min-h-10 rounded border px-3" onClick={resetPreview}>Reset preview</button>
      <label>Scene <select aria-label="Preview scene" className="min-h-10 border bg-background" value={scene} onChange={e => setScene(e.target.value)}>
        <option value="flow">Assessment flow</option>{QUESTION_BANK_V2.map(i => <option key={i.itemKey} value={i.itemKey}>{i.subskill} · {i.dimension}</option>)}
      </select></label>
    </header>
    <main className="mx-auto max-w-full" style={{ width }}>
      {scene === 'flow' ? <Routes>
        <Route path="/skill-assessment" element={<GuestSkillAssessment />} /><Route path="/auth" element={<Auth />} />
        <Route path="/player/self-assessment" element={<SelfAssessment />} /><Route path="/" element={<PublicHomepage />} />
        <Route path="/pickleball-guide" element={<PickleballGuide />} />
        <Route path="*" element={<p className="p-10">Preview destination reached.</p>} />
      </Routes> : <div className="mx-auto max-w-lg p-4"><AssessmentQuestion key={scene} item={QUESTION_BANK_V2.find(i => i.itemKey === scene)!} saving={false} onConfirm={() => setScene('flow')} /></div>}
    </main><Toaster richColors /></div></MemoryRouter></HelmetProvider>;
}
createRoot(document.getElementById('root')!).render(<AuthStateProvider><Preview /></AuthStateProvider>);
