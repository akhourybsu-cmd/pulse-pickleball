/** Decorative ECG. Two gentle passes, then still; reduced motion stays still. */
export function PulseTrace({ className = '' }: { className?: string }) {
  return <svg className={`skill-pulse-trace ${className}`} viewBox="0 0 600 64" fill="none" aria-hidden="true">
    <path className="skill-pulse-base" d="M0 34H210L228 23L244 34H263L281 5L301 59L320 24L332 34H600" />
    <path className="skill-pulse-signal" pathLength="100" d="M0 34H210L228 23L244 34H263L281 5L301 59L320 24L332 34H600" />
  </svg>;
}
