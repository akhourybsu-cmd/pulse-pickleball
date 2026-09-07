import { useLayoutEffect, useState, type CSSProperties } from 'react';

const DEFAULT_PANE_STYLE: CSSProperties = { height: '100dvh' };

function shouldPinToVisualViewport(): boolean {
  return window.matchMedia(
    '(max-width: 767px), (hover: none) and (pointer: coarse)',
  ).matches;
}

function readPaneStyle(): CSSProperties {
  if (typeof window === 'undefined' || !window.visualViewport || !shouldPinToVisualViewport()) {
    return DEFAULT_PANE_STYLE;
  }
  const viewport = window.visualViewport;
  return {
    position: 'fixed',
    top: `${viewport.offsetTop}px`,
    left: 0,
    right: 0,
    height: `${viewport.height}px`,
  };
}

/**
 * Pins a full-screen pane (e.g. a chat thread) to the *visible* viewport so an
 * on-screen keyboard never drags its sticky header off the top.
 *
 * Why this is needed: PULSE ships as an edge-to-edge Capacitor app
 * (`viewport-fit=cover`, no `@capacitor/keyboard` plugin), so on Android the
 * soft keyboard OVERLAYS the webview instead of resizing it. `100dvh` therefore
 * stays full height, the composer ends up behind the keyboard, and the browser
 * scrolls the focused input into view — which pushes the header above the top
 * edge. The VisualViewport API reports the region actually left visible above
 * the keyboard, so sizing the pane to `visualViewport.height` (and following its
 * `offsetTop`) keeps the header pinned at the top and the composer just above
 * the keyboard.
 *
 * Returns an inline style for the pane's root element. When the API is
 * unavailable (older WebViews, SSR) it falls back to an in-flow `100dvh` box,
 * i.e. the previous behavior.
 */
export function useVisualViewportPane(): CSSProperties {
  // Read synchronously so an immersive chat never paints once in-flow and
  // jumps to fixed positioning a frame later.
  const [style, setStyle] = useState<CSSProperties>(readPaneStyle);

  useLayoutEffect(() => {
    const vv = window.visualViewport;
    const media = window.matchMedia(
      '(max-width: 767px), (hover: none) and (pointer: coarse)',
    );
    let frame = 0;
    let previousSignature = '';

    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const next = readPaneStyle();
        const signature = `${next.position ?? 'flow'}:${next.top ?? 0}:${next.height}`;
        if (signature === previousSignature) return;
        previousSignature = signature;
        setStyle(next);
      });
    };

    update();
    vv?.addEventListener('resize', update);
    vv?.addEventListener('scroll', update);
    media.addEventListener('change', update);
    return () => {
      cancelAnimationFrame(frame);
      vv?.removeEventListener('resize', update);
      vv?.removeEventListener('scroll', update);
      media.removeEventListener('change', update);
    };
  }, []);

  return style;
}
