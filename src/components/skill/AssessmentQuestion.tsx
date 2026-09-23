import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, HelpCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ResponseScalePicker } from './ResponseScalePicker';
import { CourtScenario } from './CourtScenario';
import { RESPONSE_KEYS, RESPONSE_MASTERY, SUBSKILL_LABELS, type AssessmentItem, type ResponseKey } from '@/lib/skill/model';
import { MEASURE_LABELS } from '@/lib/skill/questionBankV2';
import { cn } from '@/lib/utils';
import './assessment-brand.css';
import { QuestionSkillHelp } from './SkillKnowledge';

export function AssessmentQuestion({ item, initialValue, saving, editing, onConfirm }: {
  item: AssessmentItem; initialValue?: ResponseKey; saving: boolean; editing?: boolean;
  onConfirm: (value: ResponseKey) => void;
}) {
  const [selected, setSelected] = useState<ResponseKey | null>(initialValue ?? null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  const scale = RESPONSE_KEYS.filter(k => k !== 'not_sure');
  const count = selected && selected !== 'not_sure' ? RESPONSE_MASTERY[selected]! * 10 : null;
  // A three-shot sequence counts once per rally, not once for each shot.
  const countsRallies = item.success?.includes('three consecutive');
  return (
    <section className="skill-studio skill-question-card space-y-4 rounded-2xl p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-widest text-primary">
        <span>{SUBSKILL_LABELS[item.subskill]}</span>
        {item.version === 2 && item.dimension && <span className="rounded-full bg-primary/10 px-2.5 py-1.5">{MEASURE_LABELS[item.dimension]}</span>}
      </div>
      <h2 ref={heading} tabIndex={-1} className="text-xl sm:text-2xl font-semibold leading-snug tracking-tight outline-none">{item.situation ?? item.text}</h2>
      {item.version === 2 && <>
        <CourtScenario item={item} />
        <div className="flex gap-2.5 rounded-xl bg-muted/50 p-3">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Success means</p><p className="mt-1 text-sm leading-relaxed">{item.success}</p></div>
        </div>
      </>}
      {item.version === 1 ? <fieldset disabled={saving}><ResponseScalePicker value={selected} onSelect={setSelected} /></fieldset> : <fieldset disabled={saving} className="space-y-2">
        <legend className="mb-1 text-sm font-semibold">How often do you do this successfully?</legend>
        <p className="text-xs leading-relaxed text-muted-foreground">{countsRallies ? 'Out of 10 rallies like this. Count the full three-shot sequence as one success.' : 'Out of 10 chances in recent games — not points won.'}</p>
        <div className="pt-2 text-center" aria-live="polite">
          <span className="text-3xl font-bold tabular-nums text-primary">{count ?? '—'}</span><span className="ml-1.5 text-sm text-muted-foreground">/ 10</span>
          <p className="mt-1 text-xs text-muted-foreground">{selected === 'not_sure' ? 'Not scored as zero' : count === null ? 'Slide or tap a number' : count === 0 ? 'Not yet' : count === 10 ? 'Every time' : `About ${count} out of 10`}</p>
        </div>
        <input type="range" className={cn('assessment-slider', count === null && 'opacity-40')} min={0} max={10} step={2} value={count ?? 4}
          aria-label="Successful opportunities out of ten" aria-valuetext={count === null ? 'No frequency selected' : `${count} of 10 opportunities`}
          onChange={e => setSelected(scale[Number(e.target.value) / 2])} />
        <div className="grid grid-cols-6 gap-1">
          {scale.map((key, index) => <button type="button" key={key} aria-pressed={selected === key}
            aria-label={`${index * 2} of 10 opportunities`} onClick={() => setSelected(key)}
            className={cn('min-h-11 rounded-lg border text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary', selected === key ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background')}>{index * 2}</button>)}
        </div>
        <button type="button" aria-pressed={selected === 'not_sure'} onClick={() => setSelected('not_sure')}
          className={cn('flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed px-2 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary', selected === 'not_sure' ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground')}>
          <HelpCircle size={15} /> Not enough game experience
        </button>
      </fieldset>}
      <Button className="skill-primary-button h-12 w-full gap-2 rounded-xl" disabled={selected === null || saving}
        onClick={() => selected && onConfirm(selected)}>{saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : <>{editing ? 'Save change' : 'Save & continue'}<ArrowRight className="h-4 w-4" /></>}</Button>
      {item.version === 2 && <QuestionSkillHelp skill={item.subskill} />}
    </section>
  );
}
