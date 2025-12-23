import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LogOut, User as UserIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/pulse-logo-new.png";
import { NotificationBell } from "@/components/NotificationBell";
import { NotificationDrawer, Notification } from "@/components/NotificationDrawer";
import { ModeSwitcher } from "@/components/mode/ModeSwitcher";
import { useMode } from "@/contexts/ModeContext";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

interface PageHeaderProps {
  userId?: string | null;
}

export function PageHeader({ userId }: PageHeaderProps) {
  const navigate = useNavigate();
  const [isNotificationDrawerOpen, setIsNotificationDrawerOpen] = useState(false);
  const { hasVenueAccess, isLoading: modeLoading } = useMode();

  // Fetch notifications
  const { data: notifications = [], refetch } = useQuery({
    queryKey: ["user-notifications", userId],
    queryFn: async () => {
      if (!userId) return [];
      
      const { data, error } = await supabase
        .from("user_notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data || []).map((notif): Notification => ({
        id: notif.id,
        type: notif.notification_type === "event_reminder" ? "match" : "lfg",
        title: notif.title,
        message: notif.message,
        time: new Date(notif.created_at).toLocaleString(),
        cta: "View",
        link: notif.link || "/dashboard",
        unread: !notif.read
      }));
    },
    enabled: !!userId,
    refetchInterval: 60000 // Refetch every minute
  });

  const unreadCount = notifications.filter(n => n.unread).length;

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const handleClearAll = async () => {
    if (!userId) return;
    await supabase
      .from("user_notifications")
      .delete()
      .eq("user_id", userId);
    refetch();
  };

  const handleClearOne = async (id: string) => {
    await supabase
      .from("user_notifications")
      .delete()
      .eq("id", id);
    refetch();
  };

  const handleSelectNotification = async (id: string) => {
    const notification = notifications.find(n => n.id === id);
    if (!notification) return;

    // Mark as read
    await supabase
      .from("user_notifications")
      .update({ read: true })
      .eq("id", id);
    
    refetch();
    setIsNotificationDrawerOpen(false);
    navigate(notification.link);
  };

  return (
    <nav className="border-b bg-secondary">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link to="/dashboard">
          <img 
            src={logo} 
            alt="PULSE Logo" 
            className="h-[68px] w-auto cursor-pointer hover:opacity-80 transition-opacity" 
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

      <NotificationDrawer
        isOpen={isNotificationDrawerOpen}
        notifications={notifications}
        onClose={() => setIsNotificationDrawerOpen(false)}
        onClearAll={handleClearAll}
        onClearOne={handleClearOne}
        onSelectNotification={handleSelectNotification}
      />
    </nav>
  );
}
