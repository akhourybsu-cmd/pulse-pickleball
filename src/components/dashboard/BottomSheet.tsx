import { ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from "@/components/ui/sheet";

interface BottomSheetAction {
  label: string;
  onClick: () => void;
  icon?: React.ComponentType<{ className?: string }>;
}

interface BottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  actions: BottomSheetAction[];
}

export function BottomSheet({ open, onOpenChange, title, actions }: BottomSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="bottom" 
        className={cn(
          "rounded-t-3xl border-t border-tile-border bg-tile-bg backdrop-blur-sm",
          "pb-[env(safe-area-inset-bottom,0px)]"
        )}
      >
        <SheetHeader className="text-left pb-4">
          <SheetTitle className="text-tile-ink-900 text-lg font-semibold">
            {title}
          </SheetTitle>
        </SheetHeader>
        
        <div className="flex flex-col gap-1 pb-4">
          {actions.map((action, i) => (
            <button
              key={i}
              onClick={() => {
                action.onClick();
                onOpenChange(false);
              }}
              className={cn(
                "flex items-center gap-3 w-full min-h-[48px] px-4 py-3",
                "text-left text-tile-ink-900 text-base",
                "rounded-lg hover:bg-tile-muted active:scale-[0.98]",
                "transition-all duration-150 touch-manipulation",
                "border border-transparent hover:border-tile-border"
              )}
            >
              {action.icon && <action.icon className="w-5 h-5 text-lime flex-shrink-0" />}
              <span className="font-medium">{action.label}</span>
            </button>
          ))}
        </div>
        
        <SheetClose className="absolute top-4 right-4 rounded-full p-2 hover:bg-tile-muted touch-manipulation">
          <X className="w-5 h-5 text-tile-ink-700" />
          <span className="sr-only">Close</span>
        </SheetClose>
      </SheetContent>
    </Sheet>
  );
}
