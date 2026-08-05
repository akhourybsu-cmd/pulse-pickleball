import { useEffect, useState, type CSSProperties } from 'react';

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
  const [style, setStyle] = useState<CSSProperties>({ height: '100dvh' });

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      setStyle({
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: `${vv.height}px`,
        // Follow the viewport when the keyboard offsets it (iOS) so the pane
        // always overlays the visible region rather than the layout viewport.
        transform: `translateY(${vv.offsetTop}px)`,
      });
    };

    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  return style;
}
