import { useEffect, useRef, useState } from 'react';
import { ShieldCheck, ArrowLeft, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { applicationError, EMPTY_VENUE_APPLICATION, type VenueApplicationDetails } from '@/lib/venues/venueApplications';

export function VenueApplicationForm({ initial, busy, error, onSubmit, onCancel }: {
  initial?: VenueApplicationDetails; busy: boolean; error?: string | null;
  onSubmit: (details: VenueApplicationDetails) => void; onCancel: () => void;
}) {
  const [details, setDetails] = useState({ ...EMPTY_VENUE_APPLICATION, ...initial, authorized: false });
  const [step, setStep] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, [step]);
  const [validation, setValidation] = useState<string | null>(null);
  const set = <K extends keyof VenueApplicationDetails>(key: K, value: VenueApplicationDetails[K]) => setDetails(d => ({ ...d, [key]: value }));
  const field = (key: keyof VenueApplicationDetails, label: string, options: { type?: string; placeholder?: string; maxLength?: number } = {}) => (
    <div key={key} className="min-w-0 space-y-2">
      <Label htmlFor={`venue-request-${key}`}>{label}</Label>
      <Input id={`venue-request-${key}`} value={String(details[key])} onChange={e => set(key, e.target.value as never)}
        className="h-11 rounded-xl" required maxLength={options.maxLength ?? 250} {...options} />
    </div>
  );
  return (
    <form className="overflow-hidden rounded-3xl border bg-card shadow-sm" onSubmit={e => {
      e.preventDefault(); if (busy) return;
      if (step === 0) { setStep(1); return; }
      const problem = applicationError(details); setValidation(problem); if (!problem) onSubmit(details);
    }}>
      <div className="border-b bg-muted/30 p-5 sm:p-7">
        <div className="mb-4 flex gap-2 text-xs font-medium text-muted-foreground" aria-label={`Step ${step + 1} of 2`}>
          <span className={step === 0 ? 'text-primary' : ''}>1. Venue details</span><span aria-hidden> / </span><span className={step === 1 ? 'text-primary' : ''}>2. Ownership review</span>
        </div>
        <h2 ref={heading} tabIndex={-1} className="font-sans text-2xl font-semibold tracking-tight outline-none">{step === 0 ? 'A home for your venue’s community.' : 'Let’s verify your connection.'}</h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{step === 0 ? 'Start free with posts, chat, members, invitations, files, and community events. No payment details required.' : 'PULSE staff review each request. Your venue opens after approval—not just after submitting this form.'}</p>
      </div>
      <fieldset disabled={busy} className="space-y-5 p-5 sm:p-7">
        {step === 0 ? <>
          {field('name', 'Venue name', { maxLength: 50, placeholder: 'ELEVENO Pickleball' })}
          {field('address', 'Street address')}
          <div className="grid gap-4 sm:grid-cols-2">{field('city', 'City')}{field('state', 'State / region')}</div>
          {field('website', 'Business website or public business listing', { type: 'url', placeholder: 'https://yourvenue.com' })}
          <div className="space-y-2"><Label htmlFor="venue-description">Community description (optional)</Label><Textarea id="venue-description" value={details.description} maxLength={500} rows={3} onChange={e => set('description', e.target.value)} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="venue-visibility">Discoverability</Label><select id="venue-visibility" className="h-11 w-full rounded-xl border bg-background px-3 text-sm" value={details.visibility} onChange={e => {
              set('visibility', e.target.value as VenueApplicationDetails['visibility']);
              if (e.target.value === 'private') set('join_method','invite_only');
            }}><option value="public">Public</option><option value="unlisted">Unlisted</option><option value="private">Private</option></select></div>
            <div className="space-y-2"><Label htmlFor="venue-joining">How players join</Label><select id="venue-joining" className="h-11 w-full rounded-xl border bg-background px-3 text-sm" value={details.join_method} onChange={e => set('join_method', e.target.value as VenueApplicationDetails['join_method'])}>
              {details.visibility !== 'private' && <option value="open">Join instantly</option>}<option value="request_to_join">Request approval</option><option value="invite_only">Invitation only</option></select></div>
          </div>
        </> : <>
          <div className="flex gap-3 rounded-2xl bg-primary/5 p-4 text-sm leading-6"><ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-primary" /><p>Use business contact information and publicly verifiable evidence. Do not include passwords, payment details, government IDs, or private document links.</p></div>
          {field('contact_name', 'Your full name')}
          <div className="grid gap-4 sm:grid-cols-2">{field('contact_email', 'Business contact email', { type: 'email' })}{field('contact_phone', 'Business contact phone', { type: 'tel' })}</div>
          <div className="space-y-2"><Label htmlFor="venue-evidence">How can we verify your authority?</Label><Textarea id="venue-evidence" required minLength={30} maxLength={3000} rows={5} value={details.evidence} onChange={e => set('evidence', e.target.value)} placeholder="Describe your role. Point us to an owner/staff listing or business registration, and tell us how the venue can confirm your authority through an independently listed contact." /><p className="text-xs leading-5 text-muted-foreground">Contact details and evidence stay private to you and PULSE reviewers. Review notes are shared with you.</p></div>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border p-4 text-sm leading-6"><input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-primary" checked={details.authorized} onChange={e => set('authorized', e.target.checked)} required /><span>I am the owner or an authorized representative, and I give PULSE permission to contact the business to verify this request.</span></label>
          <p className="text-sm leading-6 text-muted-foreground">After approval, customize your free venue. Court booking and facility operations are optional add-ons; they are not included or charged by this request.</p>
        </>}
        {(validation || error) && <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{validation || error}</p>}
        <div className="flex flex-wrap justify-between gap-3 border-t pt-5">
          <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={() => { if (step) { setStep(0); setValidation(null); } else onCancel(); }}><ArrowLeft className="mr-2 h-4 w-4" />{step ? 'Back' : 'Cancel'}</Button>
          <Button type="submit" className="h-11 rounded-xl px-5">{busy ? 'Submitting…' : step ? <><Check className="mr-2 h-4 w-4" />Submit for review</> : 'Continue'}</Button>
        </div>
      </fieldset>
    </form>
  );
}
