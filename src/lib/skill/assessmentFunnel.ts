export type AssessmentFunnelEvent = 'started' | 'completed' | 'save_requested' | 'auth_started' | 'saved' | 'save_failed' | 'invite_copied';
/** Integration point for consent-aware analytics. Never includes answers, levels, email or IDs. */
export function trackAssessmentFunnel(event: AssessmentFunnelEvent) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('pulse:assessment', {
    detail: { event, version: 2 },
  }));
}
