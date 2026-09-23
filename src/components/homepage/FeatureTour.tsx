import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Expand } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { isSkillAssessmentEnabled } from '@/lib/skill/featureFlag';
import { productScreens } from './productScreens';

export function FeatureTour() {
  const reduced = useReducedMotion();
  const screens = isSkillAssessmentEnabled() ? productScreens : productScreens.filter(screen => screen.key !== 'assessment');
  const [viewport, api] = useEmblaCarousel({ align: 'start', loop: false, duration: reduced ? 0 : 25 });
  const [selected, setSelected] = useState(0);
  const [expanded, setExpanded] = useState<number | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const region = useRef<HTMLDivElement | null>(null);
  const onSelect = useCallback(() => {
    if (!api) return;
    const next = api.selectedScrollSnap();
    // A drag can leave focus on the screenshot that just moved offscreen.
    const focusedSlide = api.slideNodes().findIndex(slide => slide.contains(document.activeElement));
    if (focusedSlide >= 0 && focusedSlide !== next) region.current?.focus({ preventScroll: true });
    setSelected(next);
  }, [api]);
  useEffect(() => {
    if (!api) return;
    onSelect();
    api.on('select', onSelect).on('reInit', onSelect);
    return () => { api.off('select', onSelect).off('reInit', onSelect); };
  }, [api, onSelect]);
  const keyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    const index = event.key === 'ArrowRight' ? selected + 1 : event.key === 'ArrowLeft' ? selected - 1 : event.key === 'Home' ? 0 : event.key === 'End' ? screens.length - 1 : null;
    if (index === null) return;
    event.preventDefault(); api?.scrollTo(Math.max(0, Math.min(screens.length - 1, index)));
  };

  return <div ref={region} className="mkt-tour" id="product-tour" role="region" aria-roledescription="carousel" aria-label="Explore PULSE features" tabIndex={0} onKeyDown={keyboard}>
    <div className="mkt-tour-top"><span><i aria-hidden="true" /> INSIDE PULSE</span><span className="mkt-tour-hint">Swipe or choose a feature</span></div>
    <div className="mkt-tour-viewport" ref={viewport}>
      <div className="mkt-tour-track">
        {screens.map((screen, index) => <div className={`mkt-tour-slide mkt-tour-${screen.accent}`} key={screen.key} role="group" aria-roledescription="slide" aria-label={`${index + 1} of ${screens.length}: ${screen.label}`} aria-hidden={index !== selected}>
          <div className="mkt-tour-copy"><h2>{screen.title}</h2><p>{screen.description}</p></div>
          <figure>
            <button type="button" className="mkt-screen-window" onClick={event => { opener.current = event.currentTarget; setExpanded(index); }} tabIndex={index === selected ? 0 : -1} aria-label={`Enlarge ${screen.label.toLowerCase()} screenshot`}>
              <img src={screen.src} alt={screen.alt} width={390} height={844} loading={index === 0 ? 'eager' : 'lazy'} fetchPriority={index === 0 ? 'high' : 'auto'} decoding="async" style={{ objectPosition: screen.position }} />
              <span className="mkt-screen-expand"><Expand aria-hidden="true" size={14} /> View screen</span>
            </button>
            <figcaption>Actual PULSE screen · Demo data</figcaption>
          </figure>
        </div>)}
      </div>
    </div>
    <div className="mkt-tour-controls">
      <button type="button" className="mkt-tour-arrow" aria-label="Previous feature" disabled={selected === 0} onClick={() => api?.scrollPrev()}><ArrowLeft aria-hidden="true" size={18} /></button>
      <p aria-live="polite" aria-atomic="true"><strong>{screens[selected].label}</strong><span>{selected + 1} / {screens.length}</span></p>
      <button type="button" className="mkt-tour-arrow" aria-label="Next feature" disabled={selected === screens.length - 1} onClick={() => api?.scrollNext()}><ArrowRight aria-hidden="true" size={18} /></button>
    </div>
    <div className="mkt-tour-pills" role="group" aria-label="Choose a feature">{screens.map((screen, index) => <button key={screen.key} type="button" aria-pressed={index === selected} onClick={() => api?.scrollTo(index)}>{screen.label}</button>)}</div>
    <Dialog open={expanded !== null} onOpenChange={open => { if (!open) setExpanded(null); }}>
      <DialogContent className="mkt-screen-dialog" onCloseAutoFocus={event => { event.preventDefault(); opener.current?.focus(); }}>
        <DialogTitle>{expanded !== null ? screens[expanded].label : 'PULSE screen'}</DialogTitle>
        <DialogDescription>Actual PULSE interface with demo data. This is a screenshot.</DialogDescription>
        {expanded !== null && <img src={screens[expanded].src} alt={screens[expanded].alt} width={390} height={844} />}
      </DialogContent>
    </Dialog>
  </div>;
}
