import { Suspense, useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { normalizeHex, venueChrome } from '@/lib/venues/branding';
import { VenueBrandMark, type VenueIdentity } from './VenueBrandMark';

export const VENUE_ENTRANCE_MS = 480;
export const VENUE_SLOW_LOAD_MS = 7000;

/** Shared by the actual entrance and the admin's draft preview. No remote requests. */
export function VenueLoadingScreen({ identity, slow = false, preview = false }: { identity: VenueIdentity; slow?: boolean; preview?: boolean }) {
  const chrome = venueChrome({ primary_color: identity.primaryColor, secondary_color: identity.secondaryColor });
  const accent = normalizeHex(identity.primaryColor) ?? '#c9962f';
  const Heading = preview ? 'h3' : 'h1';
  return <section aria-label={preview ? 'Venue entrance preview' : `Opening ${identity.name}`} className={`venue-entrance-surface relative isolate flex w-full min-w-0 flex-col overflow-hidden font-sans text-white ${preview ? 'min-h-[320px] rounded-2xl' : 'min-h-[100dvh]'}`} style={{ background: `linear-gradient(rgba(8,15,18,0.7), rgba(8,15,18,0.7)), ${chrome?.backgroundImage ?? 'linear-gradient(158deg, #26343a 0%, #0f171b 100%)'}`, '--venue-entrance-accent': accent } as CSSProperties}>
    <div aria-hidden className="pointer-events-none absolute inset-0 opacity-50" style={{ background: `radial-gradient(ellipse at 50% 43%, ${accent}24, transparent 60%)` }} />
    {!preview && <Link to="/player/community" className="absolute left-[max(1rem,env(safe-area-inset-left))] top-[max(1rem,env(safe-area-inset-top))] z-10 inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"><ArrowLeft className="h-4 w-4" />Community</Link>}
    <div className={`relative flex flex-1 flex-col items-center justify-center text-center ${preview ? 'px-3 py-10' : 'px-6 py-24'}`}>
      <div className="venue-entrance-mark relative mb-7 flex aspect-square w-36 max-w-full shrink-0 items-center justify-center">
        <div aria-hidden className="venue-entrance-ring absolute inset-0 rounded-full border border-white/10" />
        <VenueBrandMark {...identity} className="aspect-square w-[78%] text-[112px] shadow-[0_12px_40px_rgba(0,0,0,0.24)]" />
      </div>
      <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/70">Welcome to</p>
      <Heading className="mt-2 w-full max-w-lg font-sans text-2xl font-semibold leading-tight tracking-tight [overflow-wrap:anywhere] sm:text-3xl">{identity.name}</Heading>
      <p role={preview ? undefined : 'status'} className="mt-4 max-w-xs text-sm leading-6 text-white/65">{slow ? 'Taking a little longer. Your venue is still loading—you can return to Community at any time.' : 'Opening your venue…'}</p>
    </div>
    <p className="relative px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center text-[10px] font-medium uppercase tracking-[0.2em] text-white/40">Powered by PULSE</p>
  </section>;
}

function Ready({ children, onReady }: { children: ReactNode; onReady: () => void }) {
  // This only commits after descendants finish loading their lazy route chunks.
  useEffect(onReady, [onReady]);
  return <>{children}</>;
}

/** One entrance per mounted venue, not per tab. Page queries run behind the short animation. */
export function VenueEntrance({ identity, pending = false, bypass = false, children }: { identity: VenueIdentity; pending?: boolean; bypass?: boolean; children: ReactNode }) {
  const [elapsed, setElapsed] = useState(false);
  const [ready, setReady] = useState(false);
  const [slow, setSlow] = useState(false);
  const content = useRef<HTMLDivElement | null>(null);
  const splash = useRef<HTMLDivElement>(null);
  const readyNow = useCallback(() => setReady(true), []);
  const showing = !bypass && (pending || !ready || !elapsed);

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const skipMotion = () => { if (motion.matches) setElapsed(true); };
    skipMotion();
    const timer = window.setTimeout(() => setElapsed(true), VENUE_ENTRANCE_MS);
    const slowTimer = window.setTimeout(() => setSlow(true), VENUE_SLOW_LOAD_MS);
    motion.addEventListener('change', skipMotion);
    return () => { clearTimeout(timer); clearTimeout(slowTimer); motion.removeEventListener('change', skipMotion); };
  }, []);

  useEffect(() => {
    if (!showing && content.current && (document.activeElement === document.body || splash.current?.contains(document.activeElement))) content.current.focus({ preventScroll: true });
  }, [showing]);

  const loadingScreen = showing ? <div ref={splash} className="fixed inset-0 z-[80] overflow-y-auto overscroll-contain" data-testid="venue-entrance"><VenueLoadingScreen identity={identity} slow={slow} /></div> : null;
  return <>
    {typeof document === 'undefined' ? loadingScreen : createPortal(loadingScreen, document.body)}
    <div ref={element => { content.current = element; if (element) element.inert = showing; }} tabIndex={-1} aria-hidden={showing || undefined} className={!showing ? 'venue-content-reveal focus:outline-none' : undefined} style={showing ? { visibility: 'hidden' } : undefined}>
      <Suspense fallback={null}>{(!pending || bypass) && <Ready onReady={readyNow}>{children}</Ready>}</Suspense>
    </div>
  </>;
}
