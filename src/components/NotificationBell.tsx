import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

interface NotificationBellProps {
  unreadCount: number;
  onOpen: () => void;
}

export function NotificationBell({ unreadCount, onOpen }: NotificationBellProps) {
  const hasUnread = unreadCount > 0;
  const [isAnimating, setIsAnimating] = useState(false);
  const [prevCount, setPrevCount] = useState(unreadCount);

  // Animate when new notification arrives
  useEffect(() => {
    if (unreadCount > prevCount) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 600);
      return () => clearTimeout(timer);
    }
    setPrevCount(unreadCount);
  }, [unreadCount, prevCount]);

  return (
    <button
      onClick={onOpen}
      aria-label="Open notifications"
      className={cn(
        "relative w-10 h-10 flex items-center justify-center rounded-full active:scale-95 transition-transform",
        isAnimating && "animate-bounce"
      )}
    >
      <Bell 
        className={cn(
          "w-5 h-5 text-white transition-all",
          hasUnread && "drop-shadow-[0_0_8px_rgba(181,255,96,0.7)]",
          isAnimating && "animate-shake"
        )} 
      />
      {hasUnread && (
        <div className={cn(
          "absolute -top-1 -right-1 bg-lime-300 text-slate-900 text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-[4px] shadow-[0_0_8px_rgba(181,255,96,0.7)]",
          isAnimating && "animate-scale-fade-in"
        )}>
          {unreadCount > 99 ? "99+" : unreadCount}
        </div>
      )}
    </button>
  );
}
