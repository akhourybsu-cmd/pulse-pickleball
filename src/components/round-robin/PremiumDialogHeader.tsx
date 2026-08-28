import * as React from "react";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Shared header treatment for every Round Robin host dialog reached from the
 * three-dot controls menu.
 *
 * Keeps one visual language across Settings, Courts & games, Schedule editor,
 * Score corrections, Activity log and the guest invite: accent eyebrow, bold
 * tracking-tight title, muted one-line description and an ambient primary wash
 * bleeding down from the top edge of the sheet.
 */
export function PremiumDialogHeader({
  eyebrow = "Round Robin",
  title,
  description,
  icon: Icon,
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-28 rounded-t-lg bg-gradient-to-b from-primary/[0.10] to-transparent"
      />
      <DialogHeader className={cn("relative text-left space-y-0", className)}>
        <div className="flex items-start gap-3">
          {Icon && (
            <span className="mt-0.5 h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 border border-primary/20 bg-primary/10 text-primary">
              <Icon className="h-[18px] w-[18px]" />
            </span>
          )}
          <div className="min-w-0">
            {eyebrow && (
              <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary/80">
                {eyebrow}
              </div>
            )}
            <DialogTitle className="text-[20px] font-extrabold tracking-[-0.01em] leading-tight">
              {title}
            </DialogTitle>
            {description && (
              <DialogDescription className="mt-1 text-[12.5px] leading-snug">
                {description}
              </DialogDescription>
            )}
          </div>
        </div>
      </DialogHeader>
    </>
  );
}

/**
 * Grouped "glass" list container used for action rows inside host dialogs.
 */
export function GlassRowGroup({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/70 bg-card/80 backdrop-blur-sm overflow-hidden divide-y divide-border/60 shadow-[0_8px_30px_-16px_hsl(var(--foreground)/0.25)]",
        className,
      )}
    >
      {children}
    </div>
  );
}
