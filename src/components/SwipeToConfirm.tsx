import { useState, useRef, useEffect } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface SwipeToConfirmProps {
  onConfirm: () => void;
  onError?: (error: string) => void;
  text?: string;
  successText?: string;
}

const SwipeToConfirm = ({ 
  onConfirm, 
  onError,
  text = "Swipe to lock and submit",
  successText = "Match submitted"
}: SwipeToConfirmProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [showDesktopDialog, setShowDesktopDialog] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  
  // Detect if device supports touch
  const isTouchDevice = window.matchMedia('(hover: none) and (pointer: coarse)').matches;

  const handleStart = (clientX: number) => {
    if (isConfirmed) return;
    setIsDragging(true);
    setError("");
  };

  const handleMove = (clientX: number) => {
    if (!isDragging || !containerRef.current || !handleRef.current || isConfirmed) return;

    const container = containerRef.current.getBoundingClientRect();
    const handleWidth = handleRef.current.offsetWidth;
    const maxDistance = container.width - handleWidth;

    const distance = Math.max(0, Math.min(clientX - container.left, maxDistance));
    const newProgress = (distance / maxDistance) * 100;

    setProgress(newProgress);

    if (newProgress >= 100) {
      setIsDragging(false);
      setIsConfirmed(true);
      setTimeout(() => {
        onConfirm();
      }, 300);
    }
  };

  const handleEnd = () => {
    if (isConfirmed) return;
    setIsDragging(false);
    setProgress(0);
  };

  // Mouse events
  const handleMouseDown = (e: React.MouseEvent) => {
    handleStart(e.clientX);
  };

  const handleMouseMove = (e: MouseEvent) => {
    handleMove(e.clientX);
  };

  const handleMouseUp = () => {
    handleEnd();
  };

  // Touch events
  const handleTouchStart = (e: React.TouchEvent) => {
    handleStart(e.touches[0].clientX);
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (e.touches.length > 0) {
      handleMove(e.touches[0].clientX);
    }
  };

  const handleTouchEnd = () => {
    handleEnd();
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      window.addEventListener("touchmove", handleTouchMove);
      window.addEventListener("touchend", handleTouchEnd);

      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
        window.removeEventListener("touchmove", handleTouchMove);
        window.removeEventListener("touchend", handleTouchEnd);
      };
    }
  }, [isDragging]);

  const handleErrorFromParent = (errorMessage: string) => {
    setError(errorMessage);
    setIsConfirmed(false);
    setProgress(0);
  };

  useEffect(() => {
    if (onError) {
      // Expose error handler to parent
      (window as any).swipeToConfirmError = handleErrorFromParent;
    }
  }, [onError]);

  const handleDesktopConfirm = async () => {
    setShowDesktopDialog(false);
    setIsConfirmed(true);
    try {
      await onConfirm();
    } catch (err: any) {
      setError(err.message || "An error occurred");
      setIsConfirmed(false);
      if (onError) {
        onError(err.message || "An error occurred");
      }
    }
  };

  // Desktop: Show button with confirmation dialog
  if (!isTouchDevice) {
    return (
      <div className="space-y-2">
        <Button
          onClick={() => setShowDesktopDialog(true)}
          disabled={isConfirmed}
          className="w-full h-16 text-lg font-semibold"
          size="lg"
        >
          {isConfirmed ? (
            <>
              <Check className="w-5 h-5 mr-2" />
              {successText}
            </>
          ) : (
            text
          )}
        </Button>

        <AlertDialog open={showDesktopDialog} onOpenChange={setShowDesktopDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Match</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to confirm this match? This action will record the match results and update player ratings.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDesktopConfirm}>
                Confirm Match
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {error && (
          <p className="text-sm text-destructive text-center">
            {error}
          </p>
        )}
      </div>
    );
  }

  // Mobile/Touch: Show swipe interface
  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        className={cn(
          "relative h-16 rounded-full overflow-hidden transition-all duration-300",
          isConfirmed ? "bg-[#A9CF46]" : "bg-muted border-2 border-border"
        )}
      >
        {/* Progress fill */}
        <div
          className="absolute inset-0 bg-[#A9CF46] transition-all duration-100"
          style={{
            width: isConfirmed ? "100%" : `${progress}%`,
            opacity: isConfirmed ? 1 : 0.3,
          }}
        />

        {/* Text */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className={cn(
            "text-sm font-semibold transition-all duration-300",
            isConfirmed ? "text-white" : "text-foreground"
          )}>
            {isConfirmed ? successText : text}
          </span>
        </div>

        {/* Draggable handle */}
        <div
          ref={handleRef}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
        className={cn(
          "absolute left-1 top-1 bottom-1 flex items-center justify-center rounded-full cursor-grab active:cursor-grabbing transition-all duration-100",
          isConfirmed ? "w-14 h-14 bg-card" : "w-14 bg-primary"
        )}
          style={{
            left: isConfirmed ? 'auto' : '0.25rem',
            right: isConfirmed ? '0.25rem' : 'auto',
            transform: isConfirmed ? 'none' : `translateX(${(progress / 100) * (containerRef.current ? containerRef.current.offsetWidth - 64 : 0)}px)`,
            transition: isConfirmed ? 'all 0.3s ease' : 'none',
          }}
        >
          {isConfirmed ? (
            <Check className="w-8 h-8 text-[#A9CF46] animate-scale-in" />
          ) : (
            <div className="flex gap-1">
              <div className="w-1 h-6 bg-primary-foreground rounded-full" />
              <div className="w-1 h-6 bg-primary-foreground rounded-full" />
              <div className="w-1 h-6 bg-primary-foreground rounded-full" />
            </div>
          )}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <p className="text-sm text-destructive text-center">
          {error}
        </p>
      )}
    </div>
  );
};

export default SwipeToConfirm;
