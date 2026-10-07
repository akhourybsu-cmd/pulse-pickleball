import { forwardRef } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import "./controls.css";

/** Shared interaction treatment for round-robin actions, including portalled menus. */
export const RoundRobinButton = forwardRef<
  HTMLButtonElement,
  ButtonProps & { busy?: boolean }
>(({ className, variant = "default", size, busy, disabled, ...props }, ref) => (
  <Button
    ref={ref}
    variant={variant}
    size={size}
    className={cn("rr-button", className)}
    data-rr-variant={variant}
    data-rr-size={size}
    aria-busy={busy || undefined}
    disabled={busy ? true : disabled}
    {...props}
  />
));
RoundRobinButton.displayName = "RoundRobinButton";
