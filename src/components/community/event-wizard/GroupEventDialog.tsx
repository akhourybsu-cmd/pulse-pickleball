import { useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  ScopedThemeContext,
  useScopedTheme,
} from "@/components/ui/scoped-theme";
import { useVisualViewportPane } from "@/hooks/useVisualViewportPane";
import { EventWizardContainer } from "./EventWizardContainer";
import "@/styles/community-clubhouse.css";

export function GroupEventDialog({
  groupId,
  open,
  onOpenChange,
  children,
}: {
  groupId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  const [pending, setPending] = useState(false);
  const theme = useScopedTheme();
  const close = () => {
    if (!pending) onOpenChange(false);
  };
  return (
    <ScopedThemeContext.Provider
      value={theme ?? { className: "community-clubhouse", style: {} }}
    >
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!pending) onOpenChange(next);
        }}
      >
        <DialogTrigger asChild>{children}</DialogTrigger>
        {open && (
          <EventDialogContent>
            <DialogTitle className="sr-only">
              Create a community event
            </DialogTitle>
            <DialogDescription className="sr-only">
              Choose a format, set the schedule and player spots, then review
              your event before creating it.
            </DialogDescription>
            <EventWizardContainer
              groupId={groupId}
              onClose={close}
              onSuccess={() => onOpenChange(false)}
              onPendingChange={setPending}
            />
          </EventDialogContent>
        )}
      </Dialog>
    </ScopedThemeContext.Provider>
  );
}

function EventDialogContent({ children }: { children: ReactNode }) {
  const viewport = useVisualViewportPane();
  return (
    <DialogContent
      className="flex h-[100dvh] max-w-none flex-col gap-0 overflow-hidden rounded-none border-0 p-0 sm:h-[min(780px,92dvh)] sm:max-w-2xl sm:rounded-2xl sm:border [&>button]:hidden"
      style={viewport.position ? { ...viewport, transform: "none" } : undefined}
      onInteractOutside={(event) => event.preventDefault()}
      onOpenAutoFocus={(event) => event.preventDefault()}
    >
      {children}
    </DialogContent>
  );
}
