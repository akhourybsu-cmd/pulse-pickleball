import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";

interface NotificationBellProps {
  unreadCount: number;
  onOpen: () => void;
}

export function NotificationBell({ unreadCount, onOpen }: NotificationBellProps) {
  const hasUnread = unreadCount > 0;

  return (
    <button
      onClick={onOpen}
      aria-label="Open notifications"
      className={cn(
        "relative w-10 h-10 flex items-center justify-center rounded-full active:scale-95 transition-transform",
        hasUnread && "animate-pulse"
      )}
    >
      <Bell 
        className={cn(
          "w-5 h-5 text-white transition-all",
          hasUnread && "drop-shadow-[0_0_8px_rgba(181,255,96,0.7)]"
        )} 
      />
      {hasUnread && (
        <div className="absolute -top-1 -right-1 bg-lime-300 text-slate-900 text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-[4px] shadow-[0_0_8px_rgba(181,255,96,0.7)]">
          {unreadCount}
        </div>
      )}
    </button>
  );
}
