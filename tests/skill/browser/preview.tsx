import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import SelfAssessment from '../../../src/pages/player/SelfAssessment';
import { AssessmentQuestion } from '../../../src/components/skill/AssessmentQuestion';
import { QUESTION_BANK_V2 } from '../../../src/lib/skill/questionBankV2';
import { failNextSave, resetPreview, seedReady, seedUnknown } from './stub';
import '../../../src/index.css';
export default function Preview() {
  const [width, setWidth] = useState('100%');
  const [scene, setScene] = useState('flow');
  return <MemoryRouter initialEntries={['/player/self-assessment']}><div className="min-h-screen bg-background text-foreground">
    <header className="flex flex-wrap items-center gap-2 border-b bg-card p-3 text-xs">
      <strong className="mr-2">PULSE · Local preview</strong>
      <button className="min-h-10 rounded border px-3" onClick={() => setWidth('390px')}>Phone width</button>
      <button className="min-h-10 rounded border px-3" onClick={() => setWidth('100%')}>Full width</button>
      <button className="min-h-10 rounded border px-3" onClick={failNextSave}>Fail next save</button>
      <button className="min-h-10 rounded border px-3" onClick={seedReady}>Seed completed questions</button>
      <button className="min-h-10 rounded border px-3" onClick={seedUnknown}>Seed unsure questions</button>
      <button className="min-h-10 rounded border px-3" onClick={resetPreview}>Reset preview</button>
      <label>Scene <select aria-label="Preview scene" className="min-h-10 border bg-background" value={scene} onChange={e => setScene(e.target.value)}>
        <option value="flow">Assessment flow</option>{QUESTION_BANK_V2.map(i => <option key={i.itemKey} value={i.itemKey}>{i.subskill} · {i.dimension}</option>)}
      </select></label>
    </header>
    <main className="mx-auto max-w-full" style={{ width }}>
      {scene === 'flow' ? <SelfAssessment /> : <div className="mx-auto max-w-lg p-4"><AssessmentQuestion key={scene} item={QUESTION_BANK_V2.find(i => i.itemKey === scene)!} saving={false} onConfirm={() => setScene('flow')} /></div>}
    </main><Toaster richColors /></div></MemoryRouter>;
}
createRoot(document.getElementById('root')!).render(<Preview />);
