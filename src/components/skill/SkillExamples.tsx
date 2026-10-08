import { lazy, Suspense, useState } from 'react';
import { CURRENT_QUESTION_BANK } from '@/lib/skill/banks';
import { SUBSKILL_LABELS, type Subskill } from '@/lib/skill/model';

const CourtScenario = lazy(() => import('./CourtScenario').then(module => ({ default: module.CourtScenario })));

/** Load an illustration only when the reader requests it, including in the guide. */
export function SkillExamples({ skill }: { skill: Subskill }) {
  const examples = CURRENT_QUESTION_BANK.filter(item => item.subskill === skill);
  const [selected, setSelected] = useState(examples[0].itemKey);
  const [open, setOpen] = useState(false);
  const item = examples.find(example => example.itemKey === selected)!;
  return <div className="space-y-3">
    <button type="button" className="skill-quiet-link min-h-11 text-sm" aria-expanded={open} onClick={() => setOpen(value => !value)}>{open ? 'Hide illustrated situations' : 'Explore 4 illustrated situations'}</button>
    {open && <><label className="block text-sm">Choose a {SUBSKILL_LABELS[skill].toLowerCase()} situation<select aria-label={`${SUBSKILL_LABELS[skill]} example`} value={selected} onChange={event => setSelected(event.target.value)} className="mt-2 min-h-11 w-full rounded-lg border bg-background px-3 text-foreground">{examples.map(example => <option key={example.itemKey} value={example.itemKey}>{example.focus}</option>)}</select></label>
      <p className="text-sm">{item.situation}</p><Suspense fallback={<p role="status">Loading illustration…</p>}><CourtScenario item={item} /></Suspense><p className="text-sm"><strong>Count a success when:</strong> {item.success}</p><p className="skill-help">{item.observation?.note}</p></>}
  </div>;
}
