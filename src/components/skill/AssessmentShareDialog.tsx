import { useEffect, useRef, useState } from 'react';
import { Copy, Download, Loader2, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { copyText } from '@/lib/share';
import { assessmentCardName, downloadAssessmentCard, renderAssessmentCard, shareAssessmentCard, type AssessmentCardFormat } from '@/lib/skill/assessmentShare';
import type { ScoringSnapshot } from '@/lib/skill/scoring';
import { AssessmentShareCard } from './AssessmentShareCard';
import './assessment-brand.css';

export default function AssessmentShareDialog({ snapshot, completedAt, playerName, onClose }: {
  snapshot: ScoringSnapshot; completedAt?: string | null; playerName: string; onClose: () => void;
}) {
  const [name, setName] = useState(assessmentCardName(playerName));
  const [format, setFormat] = useState<AssessmentCardFormat>('square');
  const [prepared, setPrepared] = useState<{ key: string; file: File } | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const svg = useRef<SVGSVGElement>(null);
  const key = `${name}:${format}:${completedAt}:${retry}`;
  const file = prepared?.key === key ? prepared.file : null;
  const caption = `My PULSE self-assessed level: ${snapshot.estimatedLevelDisplay.toFixed(1)} · ${snapshot.displayBand}. A provisional snapshot of my game. Discover yours: https://pulsepb.com/skill-assessment`;
  useEffect(() => {
    let cancelled = false;
    setError(false); setPrepared(null);
    // Debounce name edits; prepare before the Share click to retain native activation.
    const timer = setTimeout(() => {
      if (!svg.current) return;
      void renderAssessmentCard(svg.current, format).then(file => {
        if (!cancelled) setPrepared({ key, file });
      }).catch(() => { if (!cancelled) setError(true); });
    }, 180);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [key, format, snapshot]);
  async function act(action: 'share' | 'download' | 'caption') {
    if (locked.current || (action !== 'caption' && !file)) return;
    locked.current = true; setBusy(true);
    try {
      if (action === 'caption') { await copyText(caption); toast.success('Caption copied'); }
      else if (action === 'download') { downloadAssessmentCard(file!); toast.success('Card downloaded'); }
      else {
        const result = await shareAssessmentCard(file!, caption);
        if (result === 'downloaded') toast.success('Card downloaded. Add it to your social post.');
      }
    } catch { toast.error('Could not share this card. Please try again.'); }
    finally { locked.current = false; setBusy(false); }
  }
  return <Dialog open onOpenChange={open => { if (!open && !locked.current) onClose(); }}>
    <DialogContent className="skill-studio skill-share-dialog" onEscapeKeyDown={event => { if (busy) event.preventDefault(); }} onPointerDownOutside={event => { if (busy) event.preventDefault(); }}>
      <DialogHeader><DialogTitle>Share your game</DialogTitle><DialogDescription>A PULSE card made for your feed, group chat, or next post.</DialogDescription></DialogHeader>
      <div className="skill-share-layout">
        <div className="skill-share-preview"><AssessmentShareCard ref={svg} snapshot={snapshot} completedAt={completedAt} name={name} format={format} /></div>
        <div className="skill-share-options">
          <fieldset disabled={busy}><legend className="text-sm font-semibold mb-2">Card format</legend><div className="skill-share-formats">
            {(['square', 'portrait'] as const).map(value => <button type="button" key={value} aria-pressed={format === value} onClick={() => setFormat(value)}><strong>{value === 'square' ? 'Square' : 'Portrait'}</strong><span>{value === 'square' ? '1080 × 1080' : '1080 × 1350'}</span></button>)}
          </div></fieldset>
          <label className="block text-sm font-semibold">Name on card <span className="font-normal text-muted-foreground">(optional)</span><input className="skill-share-name" maxLength={40} value={name} onChange={event => setName(Array.from(event.target.value).slice(0, 40).join(''))} disabled={busy} placeholder="Leave blank to hide your name" autoComplete="off" /></label>
          <p className="skill-help">Only the details shown on this card are included. Your answers and profile privacy stay unchanged.</p>
          <div role="status" aria-live="polite" className="skill-share-status">{error ? <><span>Couldn’t prepare the image.</span><Button variant="outline" size="sm" onClick={() => setRetry(v => v + 1)}>Retry image</Button></> : !file ? <><Loader2 className="h-4 w-4 animate-spin" /> Preparing your card…</> : 'Your image is ready to share.'}</div>
          <Button disabled={!file || busy} className="skill-primary-button gap-2" onClick={() => void act('share')}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />} Share card</Button>
          <Button disabled={!file || busy} variant="outline" className="gap-2" onClick={() => void act('download')}><Download className="h-4 w-4" /> Download PNG</Button>
          <Button disabled={busy} variant="ghost" className="gap-2" onClick={() => void act('caption')}><Copy className="h-4 w-4" /> Copy caption</Button>
          <p className="skill-help">If your browser can’t share images, Share card downloads the PNG for you to upload.</p>
        </div>
      </div>
    </DialogContent>
  </Dialog>;
}
