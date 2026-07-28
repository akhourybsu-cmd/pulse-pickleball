import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DUR, PRESSABLE } from "@/lib/leagues/motion";

/**
 * Drop-in replacement for the shared <Button> across the Ladder League
 * surface. Same props + variants + layout — it only *adds* interaction
 * states, so swapping `<Button>` → `<ActionButton>` never changes the
 * visual design or spacing.
 *
 * What it adds:
 *   • Press feedback — a subtle transform compression (motion-safe only).
 *   • Keyboard focus — inherited from Button's focus-visible ring.
 *   • Loading — spinner overlays the CENTER while the label stays put, so
 *     the button width never changes and there's no layout shift. Clicks
 *     are swallowed while loading, preventing duplicate submissions.
 *   • Success — a brief checkmark confirmation, then it settles back.
 *   • Disabled — inherited from Button (dimmed, non-interactive).
 *
 * Loading/success can be driven two ways:
 *   1. Controlled: pass `loading` / `success` booleans (drop-in for the
 *      existing local busy-flag pattern, e.g. `loading={processing}`).
 *   2. Auto: pass `onClickAsync` — the button manages its own loading
 *      while the promise is in flight and flashes success on resolve.
 *
 * Reduced motion: the spinner still spins (it communicates state, not
 * decoration), but the press compression and the success pop are removed.
 */
export interface ActionButtonProps extends ButtonProps {
  /** Controlled loading — shows the spinner + blocks interaction. */
  loading?: boolean;
  /** Controlled success — shows a brief checkmark. */
  success?: boolean;
  /**
   * Async handler. While the returned promise is pending the button is in
   * its loading state; on resolve it flashes success. Rejections re-throw
   * after clearing loading, so callers can still toast the error.
   */
  onClickAsync?: (e: React.MouseEvent<HTMLButtonElement>) => Promise<unknown>;
  /** How long the success checkmark stays, ms. Default 1100. */
  successMs?: number;
}

const ActionButton = React.forwardRef<HTMLButtonElement, ActionButtonProps>(
  (
    {
      loading, success, onClickAsync, onClick, successMs = 1100,
      disabled, className, children, ...props
    },
    ref,
  ) => {
    const reduced = useReducedMotion();
    const [pending, setPending] = React.useState(false);
    const [flash, setFlash] = React.useState(false);
    const flashTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const mounted = React.useRef(true);

    React.useEffect(() => {
      mounted.current = true;
      return () => {
        mounted.current = false;
        if (flashTimer.current) clearTimeout(flashTimer.current);
      };
    }, []);

    const isLoading = loading || pending;
    const isSuccess = (success || flash) && !isLoading;

    const startSuccessFlash = React.useCallback(() => {
      if (reduced) return; // controlled `success` still renders; skip the auto-flash timer churn
      setFlash(true);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => {
        if (mounted.current) setFlash(false);
      }, successMs);
    }, [reduced, successMs]);

    const handleClick = React.useCallback(
      async (e: React.MouseEvent<HTMLButtonElement>) => {
        if (isLoading) return; // guard against double submits
        onClick?.(e);
        if (e.defaultPrevented || !onClickAsync) return;
        try {
          setPending(true);
          await onClickAsync(e);
          if (mounted.current) startSuccessFlash();
        } finally {
          if (mounted.current) setPending(false);
        }
      },
      [isLoading, onClick, onClickAsync, startSuccessFlash],
    );

    return (
      <Button
        ref={ref}
        aria-busy={isLoading || undefined}
        disabled={disabled || isLoading}
        onClick={handleClick}
        className={cn(PRESSABLE, "relative", className)}
        {...props}
      >
        {/* Label keeps its exact footprint; we only fade it so the button
            width is stable through every state (no reflow / jump). */}
        <span
          className={cn(
            "inline-flex items-center justify-center gap-2 motion-safe:transition-opacity",
            (isLoading || isSuccess) && "opacity-0",
          )}
        >
          {children}
        </span>

        {/* Center overlays — absolutely positioned so they never affect width. */}
        <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {isLoading && <Loader2 className="animate-spin" aria-hidden />}
          <AnimatePresence>
            {isSuccess && (
              <motion.span
                key="ok"
                initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
                animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: DUR.hover, ease: "easeOut" }}
                className="inline-flex"
              >
                <Check aria-hidden />
              </motion.span>
            )}
          </AnimatePresence>
        </span>
      </Button>
    );
  },
);
ActionButton.displayName = "ActionButton";

export { ActionButton };
