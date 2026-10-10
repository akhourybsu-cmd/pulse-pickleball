/** A short-lived, internal return destination carried by router state. */
export interface ReturnContext {
  to: string;
  label: string;
  historyIndex?: number;
  scrollY: number;
}

type SourceLocation = { pathname: string; search: string; hash: string };
const allowedPath = /^\/player\/(?:social|messages|friends|leagues|community)(?:[/?#]|$)/;

export function browserHistoryIndex(): number | undefined {
  const index = typeof window !== 'undefined' ? window.history?.state?.idx : undefined;
  return Number.isSafeInteger(index) && index >= 0 ? index : undefined;
}

export function returnContextState(location: SourceLocation, label: string) {
  return { returnContext: {
    to: location.pathname + location.search + location.hash,
    label,
    historyIndex: browserHistoryIndex(),
    scrollY: typeof window === 'undefined' ? 0 : window.scrollY || 0,
  } satisfies ReturnContext };
}

export function readReturnContext(state: unknown): ReturnContext | null {
  if (!state || typeof state !== 'object' || !('returnContext' in state)) return null;
  const value = state.returnContext as Partial<ReturnContext> | null;
  if (!value || typeof value !== 'object' || typeof value.to !== 'string' ||
      !allowedPath.test(value.to) || /[\\\r\n]/.test(value.to) ||
      typeof value.label !== 'string' || !value.label.trim()) return null;
  return {
    to: value.to,
    label: value.label.slice(0, 100),
    historyIndex: Number.isSafeInteger(value.historyIndex) && value.historyIndex! >= 0
      ? value.historyIndex : undefined,
    scrollY: Number.isFinite(value.scrollY) && value.scrollY! >= 0 ? value.scrollY! : 0,
  };
}

/** Skip any intermediate tab entries and return to the original history entry. */
export function returnHistoryDelta(context: ReturnContext, currentIndex: number | undefined) {
  if (context.historyIndex == null || currentIndex == null) return null;
  const distance = currentIndex - context.historyIndex;
  return distance > 0 ? -distance : null;
}
