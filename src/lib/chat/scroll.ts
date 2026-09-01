export interface ScrollMetrics {
  scrollHeight: number;
  scrollTop: number;
  clientHeight: number;
}

/** Whether an incoming message should keep the conversation pinned to latest. */
export function isChatNearBottom(metrics: ScrollMetrics, threshold = 96): boolean {
  return metrics.scrollHeight - metrics.scrollTop - metrics.clientHeight < threshold;
}

/**
 * Preserve the same visible message after older rows are prepended. The amount
 * the document grew is added to the old scrollTop, cancelling the insertion.
 */
export function anchoredScrollTop(
  previousTop: number,
  previousHeight: number,
  currentHeight: number,
): number {
  return Math.max(0, previousTop + (currentHeight - previousHeight));
}

/**
 * Keep the same content pinned immediately above the composer when the chat
 * viewport changes height (most notably when a mobile keyboard opens/closes).
 */
export function viewportResizeAnchoredScrollTop(
  previousTop: number,
  previousClientHeight: number,
  currentClientHeight: number,
  scrollHeight: number,
): number {
  const maxScrollTop = Math.max(0, scrollHeight - currentClientHeight);
  return Math.max(
    0,
    Math.min(maxScrollTop, previousTop + previousClientHeight - currentClientHeight),
  );
}
