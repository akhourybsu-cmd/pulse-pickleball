import * as React from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerClose,
} from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import "./event.css";

/**
 * One shell for every Round Robin settings surface.
 *
 *   Mobile  → bottom sheet (vaul). Grabber + swipe-to-dismiss, body scrolls
 *             independently, actions pinned to the bottom above the safe area
 *             so the primary button is always reachable with a thumb.
 *   Desktop → centred dialog, unchanged behaviour.
 *
 * Callers pass `footer` instead of rendering their own DialogFooter — that's
 * what keeps the action bar sticky on small screens.
 */
export function ResponsiveSettingsModal({
  open,
  onOpenChange,
  title,
  description,
  footer,
  children,
  className,
  /** Small accent eyebrow above the title. */
  eyebrow = "Round Robin",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  eyebrow?: string;
}) {
  const isMobile = useIsMobile();

  const wash = (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-primary/[0.10] to-transparent"
    />
  );

  const heading = (
    <>
      {eyebrow && (
        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary/80">
          {eyebrow}
        </div>
      )}
      <span className="block text-[20px] font-extrabold tracking-[-0.01em] leading-tight">
        {title}
      </span>
    </>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="rr-event-modal max-h-[calc(100dvh-env(safe-area-inset-top)-16px)] border-t border-border/60">
          {wash}
          <DrawerHeader className="relative shrink-0 text-left pb-4 pt-3 pr-16">
            <DrawerTitle asChild><div>{heading}</div></DrawerTitle>
            {description && (
              <DrawerDescription className="text-xs leading-snug">
                {description}
              </DrawerDescription>
            )}
            <DrawerClose className="rr-modal-close" aria-label={`Close ${title}`}><X className="h-5 w-5" /></DrawerClose>
          </DrawerHeader>

          <div className="rr-event-modal-scroll relative flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
            {children}
          </div>

          {footer && (
            <div className="relative flex-shrink-0 border-t border-border/60 bg-background/95 backdrop-blur px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {footer}
            </div>
          )}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "rr-event-modal sm:max-w-[680px] max-h-[90dvh] flex flex-col overflow-hidden border-border/70",
          className,
        )}
      >
        {wash}
        <DialogHeader className="relative flex-shrink-0 text-left pr-8">
          <DialogTitle asChild><div>{heading}</div></DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="rr-event-modal-scroll relative flex-1 overflow-y-auto px-1">{children}</div>

        {footer && (
          <div className="relative flex-shrink-0 pt-3 border-t border-border/60">{footer}</div>
        )}
      </DialogContent>
    </Dialog>
  );
}


/** Two-button action bar: stacked & full-width on mobile, inline on desktop. */
export function ModalActions({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 [&>button]:h-11 [&>button]:w-full sm:[&>button]:w-auto">
      {children}
    </div>
  );
}
