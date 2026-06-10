import { ReactNode, forwardRef } from "react";
import { cn } from "@/lib/utils";

interface HubCardProps {
  children: ReactNode;
  /** Card variant: plain (default), elevated (subtle shadow + gradient), or
   *  interactive (hover state for buttons / clickable cards). */
  variant?: "plain" | "elevated" | "interactive";
  /** When true, removes the inner padding so callers can control density. */
  noPadding?: boolean;
  /** Optional click handler. Sets role="button" and adds active scale. */
  onClick?: () => void;
  /** Optional inline style passthrough (rare). */
  style?: React.CSSProperties;
  className?: string;
  /** ARIA label for interactive cards. */
  "aria-label"?: string;
}

/**
 * Standard card surface used across Home / Matches / Play / Profile.
 *
 * Replaces three+ ad-hoc card flavors that drifted across the player tabs:
 *  - the "border-2 + shadow-lg" match history cards
 *  - the "border + gradient-from-card-to-primary" dashboard tiles
 *  - the "border-border/60 + hover:bg-accent/40" profile hub links
 *
 * Variants:
 *  - plain        — simple bordered surface, no shadow
 *  - elevated     — soft gradient + shadow, used for primary hero content
 *  - interactive  — hover/active states for clickable cards
 */
export const HubCard = forwardRef<HTMLDivElement, HubCardProps>(
  ({ children, variant = "plain", noPadding = false, onClick, style, className, ...rest }, ref) => {
    const isInteractive = variant === "interactive" || !!onClick;

    return (
      <div
        ref={ref}
        onClick={onClick}
        role={isInteractive ? "button" : undefined}
        tabIndex={isInteractive ? 0 : undefined}
        onKeyDown={
          isInteractive
            ? (e) => {
                if ((e.key === "Enter" || e.key === " ") && onClick) {
                  e.preventDefault();
                  onClick();
                }
              }
            : undefined
        }
        aria-label={rest["aria-label"]}
        style={style}
        className={cn(
          "rounded-2xl border border-border/60 bg-card",
          !noPadding && "p-4 sm:p-5",
          variant === "elevated" &&
            "shadow-[0_2px_12px_-4px_hsl(var(--foreground)/0.06)]",
          isInteractive && [
            "cursor-pointer transition-all duration-200 ease-out",
            "hover:border-primary/40 hover:shadow-[0_2px_12px_-4px_hsl(var(--primary)/0.12)]",
            "active:scale-[0.99]",
          ],
          className,
        )}
      >
        {children}
      </div>
    );
  },
);

HubCard.displayName = "HubCard";
