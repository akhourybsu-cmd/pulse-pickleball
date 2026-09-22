import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, HelpCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ResponseScalePicker } from './ResponseScalePicker';
import { CourtScenario } from './CourtScenario';
import { RESPONSE_KEYS, RESPONSE_MASTERY, SUBSKILL_LABELS, type AssessmentItem, type ResponseKey } from '@/lib/skill/model';
import { MEASURE_LABELS } from '@/lib/skill/questionBankV2';
import { cn } from '@/lib/utils';

export function AssessmentQuestion({ item, initialValue, saving, editing, onConfirm }: {
  item: AssessmentItem; initialValue?: ResponseKey; saving: boolean; editing?: boolean;
  onConfirm: (value: ResponseKey) => void;
}) {
  const [selected, setSelected] = useState<ResponseKey | null>(initialValue ?? null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  const scale = RESPONSE_KEYS.filter(k => k !== 'not_sure');
  const count = selected && selected !== 'not_sure' ? RESPONSE_MASTERY[selected]! * 10 : null;
  return (
    <section className="space-y-4 rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-widest text-primary">
        <span>{SUBSKILL_LABELS[item.subskill]}</span>
        {item.version === 2 && item.dimension && <span className="rounded-full bg-primary/10 px-2.5 py-1.5">{MEASURE_LABELS[item.dimension]}</span>}
      </div>
      <h2 ref={heading} tabIndex={-1} className="text-lg font-semibold leading-snug outline-none">{item.situation ?? item.text}</h2>
      {item.version === 2 && <>
        <CourtScenario item={item} />
        <div className="flex gap-2.5 rounded-xl bg-muted/50 p-3">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Count it as a success when</p><p className="mt-1 text-sm leading-relaxed">{item.success}</p></div>
        </div>
      </>}
      {item.version === 1 ? <fieldset disabled={saving}><ResponseScalePicker value={selected} onSelect={setSelected} /></fieldset> : <fieldset disabled={saving} className="space-y-2">
        <legend className="mb-2 text-sm font-semibold">Out of 10 opportunities like this, how many succeed?</legend>
        <p className="text-xs leading-relaxed text-muted-foreground">Your last 10 games · similar opponents · successful opportunities, not points won. Drills only? Choose “Not enough game experience”.</p>
        <div className="pt-2 text-center" aria-live="polite">
          <span className="text-3xl font-bold tabular-nums text-primary">{count ?? '—'}</span><span className="ml-1.5 text-sm text-muted-foreground">/ 10</span>
          <p className="mt-1 text-xs text-muted-foreground">{selected === 'not_sure' ? 'More game experience needed' : count === null ? 'Slide or tap a number to choose' : count === 0 ? 'Not yet in games' : count === 10 ? 'Nearly every opportunity' : `About ${count} successful opportunities`}</p>
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
      <Button className="h-12 w-full gap-2 rounded-xl" disabled={selected === null || saving}
        onClick={() => selected && onConfirm(selected)}>{saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : <>{editing ? 'Save change' : 'Save & continue'}<ArrowRight className="h-4 w-4" /></>}</Button>
      <p className="text-center text-[11px] text-muted-foreground">Your answer saves when you continue. You can review it later.</p>
    </section>
  );
}
