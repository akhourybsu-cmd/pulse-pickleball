import { cn } from "@/lib/utils";

/**
 * Stylized top-down pickleball court, drawn in `currentColor` so callers
 * set the tint + opacity via text color. Used as a faint background
 * texture behind hero / CTA bands to make the marketing surface read as
 * unmistakably pickleball rather than generic SaaS.
 *
 * Geometry mirrors a real court: outer boundary, the net line across the
 * middle, the non-volley "kitchen" zones flanking the net, and the
 * center service lines that stop at the kitchen (never cross it).
 */
export const CourtMotif = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 440 200"
    fill="none"
    aria-hidden="true"
    className={cn("select-none", className)}
  >
    <g
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      vectorEffect="non-scaling-stroke"
    >
      {/* Outer boundary */}
      <rect x="8" y="8" width="424" height="184" rx="6" />
      {/* Net line across the middle */}
      <line x1="220" y1="8" x2="220" y2="192" strokeDasharray="4 6" />
      {/* Kitchen (non-volley zone) either side of the net */}
      <line x1="150" y1="8" x2="150" y2="192" />
      <line x1="290" y1="8" x2="290" y2="192" />
      {/* Center service lines — stop at the kitchen line */}
      <line x1="8" y1="100" x2="150" y2="100" />
      <line x1="290" y1="100" x2="432" y2="100" />
    </g>
  </svg>
);
