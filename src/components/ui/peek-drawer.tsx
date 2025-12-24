import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const PeekDrawer = DialogPrimitive.Root;

const PeekDrawerTrigger = DialogPrimitive.Trigger;

const PeekDrawerClose = DialogPrimitive.Close;

const PeekDrawerPortal = DialogPrimitive.Portal;

const PeekDrawerOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/20 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
));
PeekDrawerOverlay.displayName = DialogPrimitive.Overlay.displayName;

interface PeekDrawerContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  hideCloseButton?: boolean;
}

const PeekDrawerContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  PeekDrawerContentProps
>(({ className, children, hideCloseButton = false, ...props }, ref) => (
  <PeekDrawerPortal>
    <PeekDrawerOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        // Peek drawer - partial width with rounded left corners
        "fixed inset-y-0 right-0 z-50 flex h-full w-[88%] max-w-xl flex-col",
        // Premium shape - rounded left corners only
        "rounded-l-2xl",
        // Background and shadow for depth
        "bg-background shadow-2xl",
        // Border for definition
        "border-l border-border/50",
        // Smooth animations
        "data-[state=open]:animate-peek-slide-in data-[state=closed]:animate-peek-slide-out",
        className
      )}
      {...props}
    >
      {children}
      {!hideCloseButton && (
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-full p-2 bg-background/80 backdrop-blur-sm ring-offset-background transition-all hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none z-10">
          <X className="h-5 w-5" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </PeekDrawerPortal>
));
PeekDrawerContent.displayName = DialogPrimitive.Content.displayName;

const PeekDrawerHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)}
    {...props}
  />
);
PeekDrawerHeader.displayName = "PeekDrawerHeader";

const PeekDrawerFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)}
    {...props}
  />
);
PeekDrawerFooter.displayName = "PeekDrawerFooter";

const PeekDrawerTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
PeekDrawerTitle.displayName = DialogPrimitive.Title.displayName;

const PeekDrawerDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
PeekDrawerDescription.displayName = DialogPrimitive.Description.displayName;

export {
  PeekDrawer,
  PeekDrawerPortal,
  PeekDrawerOverlay,
  PeekDrawerTrigger,
  PeekDrawerClose,
  PeekDrawerContent,
  PeekDrawerHeader,
  PeekDrawerFooter,
  PeekDrawerTitle,
  PeekDrawerDescription,
};
