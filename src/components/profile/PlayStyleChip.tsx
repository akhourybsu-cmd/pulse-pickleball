import { cn } from "@/lib/utils";
import { ReactNode, useState } from "react";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { X, ChevronRight } from "lucide-react";

interface PlayStyleChipProps {
  icon: ReactNode;
  label: string;
  description?: string;
  className?: string;
}

export const PlayStyleChip = ({ 
  icon, 
  label, 
  description,
  className 
}: PlayStyleChipProps) => {
  const [open, setOpen] = useState(false);
  const isInteractive = !!description;

  return (
    <>
      <button
        onClick={() => isInteractive && setOpen(true)}
        disabled={!isInteractive}
        className={cn(
          "inline-flex items-center gap-2 px-3.5 py-2 rounded-xl",
          "bg-muted/50 dark:bg-muted/30 border border-border/50",
          "text-sm font-medium text-foreground",
          "transition-all duration-200",
          isInteractive && [
            "hover:bg-muted/70 hover:border-border/70 hover:shadow-sm",
            "active:scale-[0.97] active:opacity-90",
            "cursor-pointer"
          ],
          !isInteractive && "cursor-default",
          className
        )}
      >
        <span className="text-primary/80">{icon}</span>
        <span className="capitalize">{label}</span>
        {isInteractive && (
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60 ml-auto" />
        )}
      </button>

      {isInteractive && (
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent className="max-h-[50vh]">
            <DrawerHeader className="relative">
              <DrawerClose asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-4 top-4 h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              </DrawerClose>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl text-primary">{icon}</span>
                <DrawerTitle className="text-xl font-display capitalize">
                  {label}
                </DrawerTitle>
              </div>
              <DrawerDescription className="text-left text-base leading-relaxed">
                {description}
              </DrawerDescription>
            </DrawerHeader>
          </DrawerContent>
        </Drawer>
      )}
    </>
  );
};
