import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LogOut, User as UserIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/pulse-logo-premium.svg";
import { NotificationBell } from "@/components/NotificationBell";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { ModeSwitcher } from "@/components/mode/ModeSwitcher";
import { useMode } from "@/contexts/ModeContext";
import { useState } from "react";
import { useNotifications } from "@/hooks/useNotifications";

interface PageHeaderProps {
  userId?: string | null;
}

export function PageHeader({ userId }: PageHeaderProps) {
  const navigate = useNavigate();
  const [isNotificationDrawerOpen, setIsNotificationDrawerOpen] = useState(false);
  const { hasVenueAccess, isLoading: modeLoading } = useMode();

  // Use the new real-time notifications hook
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
    groupedByTime,
  } = useNotifications(userId, { showToasts: true });

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <nav className="bg-secondary border-b border-secondary-foreground/10 shadow-sm">
      <div className="w-full max-w-[1280px] mx-auto px-4 lg:px-6 py-5 flex items-center justify-between h-[72px]">
        <Link to="/player/dashboard">
          <img 
            src={logo} 
            alt="PULSE Logo" 
            className="h-[60px] sm:h-[75px] w-auto cursor-pointer hover:opacity-80 transition-opacity" 
          />
        </Link>
        <div className="flex items-center gap-3">
          {userId && (
            <>
              <NotificationBell 
                unreadCount={unreadCount} 
                onOpen={() => setIsNotificationDrawerOpen(true)}
              />
              <Button 
                variant="outline" 
                size="icon" 
                onClick={() => navigate(`/profile/${userId}`)} 
                className="rounded-full"
              >
                <UserIcon className="h-[1.2rem] w-[1.2rem]" />
                <span className="sr-only">View Profile</span>
              </Button>
              {!modeLoading && hasVenueAccess && <ModeSwitcher />}
            </>
          )}
          <ThemeToggle />
          <Button variant="secondary" size="sm" onClick={handleSignOut}>
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>

      <NotificationCenter
        isOpen={isNotificationDrawerOpen}
        notifications={notifications}
        unreadCount={unreadCount}
        groupedByTime={groupedByTime}
        onClose={() => setIsNotificationDrawerOpen(false)}
        onMarkAsRead={markAsRead}
        onMarkAllAsRead={markAllAsRead}
        onDelete={deleteNotification}
        onClearAll={clearAll}
      />
    </nav>
  );
}
