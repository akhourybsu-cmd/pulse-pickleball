import { useState } from 'react';
import { Check, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AssessmentQuestion } from './AssessmentQuestion';
import { SUBSKILL_LABELS, RESPONSE_MASTERY, RESPONSE_LABELS, clamp } from '@/lib/skill/model';
import type { useSkillAssessment } from '@/hooks/useSkillAssessment';
import { PulseTrace } from './PulseTrace';
import './assessment-brand.css';

export type AssessmentWizardState = Pick<ReturnType<typeof useSkillAssessment>,
  'bank' | 'responses' | 'nextItemKey' | 'answeredCount' | 'complete' | 'canFinalize' |
  'maxItems' | 'assessmentVersion' | 'saving' | 'answer' | 'finalize'>;

export function AssessmentWizard({ a, onExit }: { a: AssessmentWizardState; onExit: () => void }) {
  const [reviewing, setReviewing] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const itemKey = editingKey ?? a.nextItemKey;
  const item = a.bank.find(i => i.itemKey === itemKey);
  const answered = a.answeredCount;
  const pct = a.complete ? 100 : Math.round(clamp(answered / a.maxItems * 100, 0, 99));
  const reviewList = a.bank.filter(i => a.responses[i.itemKey] !== undefined);
  const review = <div className="space-y-3">
    <h2 className="text-lg font-semibold">Review your answers</h2>
    <p className="text-xs text-muted-foreground">Tap an answer to change it. Updates may add a follow-up question.</p>
    {reviewList.map(i => {
      const response = a.responses[i.itemKey];
      const value = RESPONSE_MASTERY[response];
      return <button type="button" key={i.itemKey} disabled={a.saving} onClick={() => { setEditingKey(i.itemKey); setReviewing(false); }}
        className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border bg-card p-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
        <span className="min-w-0"><span className="block text-[10px] font-semibold uppercase tracking-wider text-primary">{SUBSKILL_LABELS[i.subskill]}</span>
          <span className="mt-1 block text-sm">{i.situation ?? i.text}</span></span>
        <span className="shrink-0 text-xs font-semibold">{i.version === 1 ? RESPONSE_LABELS[response] : value === null ? 'Unsure' : `${value * 10}/10`}</span>
      </button>;
    })}
  </div>;
  return <div className="skill-studio mx-auto max-w-2xl space-y-4">
    <div className="skill-wizard-progress flex items-center justify-between gap-3 text-xs">
      <span className="font-semibold">{answered} saved · up to {a.maxItems}</span>
      <button type="button" disabled={a.saving} onClick={onExit} className="min-h-11 rounded-lg px-2 text-muted-foreground">Exit</button>
    </div>
    <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${answered} saved answers, maximum ${a.maxItems}`}>
      <div className="h-full bg-gradient-to-r from-primary to-emerald-300 motion-safe:transition-[width]" style={{ width: `${pct}%` }} />
    </div>
    {a.assessmentVersion === 1 && <p className="rounded-xl bg-muted p-3 text-xs text-muted-foreground">You’re finishing an earlier assessment with its original questions and scoring. Your next assessment will use the updated format.</p>}
    {reviewing ? review : editingKey || !a.complete ? item && <AssessmentQuestion key={item.itemKey} item={item} initialValue={a.responses[item.itemKey]} saving={a.saving} editing={!!editingKey}
      onConfirm={async value => { const saved = await a.answer(item.itemKey, value); if (saved && editingKey) { setEditingKey(null); setReviewing(true); } }} /> : <section className="space-y-4 rounded-2xl border bg-card p-5 text-center">
        <Check className="mx-auto h-9 w-9 text-primary" />
        <PulseTrace />
        <h2 className="text-xl font-semibold">{a.canFinalize ? 'Ready for your results' : 'More game experience needed'}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{a.canFinalize ? 'See your estimated level, strengths and next steps.' : 'Review any unsure answers, or return after more games. Missing experience won’t lower your rating.'}</p>
        <Button disabled={!a.canFinalize || a.saving} onClick={a.finalize} className="skill-primary-button h-12 w-full rounded-xl">See my results <ChevronRight className="ml-2 h-4 w-4" /></Button>
      </section>}
    {answered > 0 && <Button variant="outline" disabled={a.saving} className="min-h-11 w-full rounded-xl"
      onClick={() => { setEditingKey(null); setReviewing(v => !v); }}>{editingKey ? 'Cancel edit' : reviewing ? 'Back to assessment' : `Review ${answered} saved answers`}</Button>}
  </div>;
}
