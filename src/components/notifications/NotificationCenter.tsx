import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, Bell, CheckCheck, Trash2, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { NotificationItem } from "./NotificationItem";
import type { Notification } from "@/hooks/useNotifications";

interface NotificationCenterProps {
  isOpen: boolean;
  notifications: Notification[];
  unreadCount: number;
  groupedByTime: () => {
    today: Notification[];
    yesterday: Notification[];
    thisWeek: Notification[];
    earlier: Notification[];
  };
  onClose: () => void;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
}

const categories = [
  { value: "all", label: "All" },
  { value: "matches", label: "Matches" },
  { value: "events", label: "Events" },
  { value: "community", label: "Community" },
  { value: "achievements", label: "Awards" },
];

export function NotificationCenter({
  isOpen,
  notifications,
  unreadCount,
  groupedByTime,
  onClose,
  onMarkAsRead,
  onMarkAllAsRead,
  onDelete,
  onClearAll,
}: NotificationCenterProps) {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState("all");

  const handleSelect = async (notificationId: string) => {
    const notification = notifications.find(n => n.id === notificationId);
    if (!notification) return;

    await onMarkAsRead(notificationId);
    onClose();
    
    if (notification.link) {
      navigate(notification.link);
    }
  };

  const filteredNotifications = activeCategory === "all"
    ? notifications
    : notifications.filter(n => n.category === activeCategory);

  const grouped = groupedByTime();
  
  const getFilteredGroup = (group: Notification[]) => {
    if (activeCategory === "all") return group;
    return group.filter(n => n.category === activeCategory);
  };

  const renderGroup = (title: string, items: Notification[]) => {
    if (items.length === 0) return null;
    
    return (
      <div className="space-y-1">
        <h3 className="text-xs font-medium text-muted-foreground px-3 py-2 sticky top-0 bg-background/95 backdrop-blur-sm">
          {title}
        </h3>
        {items.map(notification => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            onSelect={handleSelect}
            onDismiss={onDelete}
          />
        ))}
      </div>
    );
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 bg-background/80 backdrop-blur-sm z-50 transition-opacity",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={cn(
          "fixed top-0 right-0 h-full w-full sm:w-[400px] bg-background border-l shadow-xl z-50",
          "transform transition-transform duration-300 ease-out",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Notifications</h2>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 text-xs font-medium bg-primary text-primary-foreground rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                onClose();
                navigate("/settings/notifications");
              }}
              className="h-8 w-8"
            >
              <Settings className="h-4 w-4" />
              <span className="sr-only">Settings</span>
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Button>
          </div>
        </div>

        {/* Category Tabs */}
        <Tabs value={activeCategory} onValueChange={setActiveCategory} className="w-full">
          <div className="border-b px-2">
            <TabsList className="h-10 w-full justify-start bg-transparent gap-1 overflow-x-auto">
              {categories.map(cat => {
                const count = cat.value === "all" 
                  ? notifications.filter(n => !n.read).length
                  : notifications.filter(n => n.category === cat.value && !n.read).length;
                
                return (
                  <TabsTrigger
                    key={cat.value}
                    value={cat.value}
                    className="text-xs px-3 py-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-full"
                  >
                    {cat.label}
                    {count > 0 && (
                      <span className="ml-1.5 text-[10px]">({count})</span>
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>

          {/* Actions bar */}
          <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
            <Button
              variant="ghost"
              size="sm"
              onClick={onMarkAllAsRead}
              disabled={unreadCount === 0}
              className="text-xs h-7 gap-1.5"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearAll}
              disabled={notifications.length === 0}
              className="text-xs h-7 gap-1.5 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear all
            </Button>
          </div>

          {/* Notification List */}
          <TabsContent value={activeCategory} className="m-0 h-[calc(100vh-180px)]">
            <ScrollArea className="h-full">
              {filteredNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Bell className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-medium text-muted-foreground">No notifications</h3>
                  <p className="text-sm text-muted-foreground/70 mt-1">
                    You're all caught up!
                  </p>
                </div>
              ) : (
                <div className="p-2 space-y-4">
                  {renderGroup("Today", getFilteredGroup(grouped.today))}
                  {renderGroup("Yesterday", getFilteredGroup(grouped.yesterday))}
                  {renderGroup("This Week", getFilteredGroup(grouped.thisWeek))}
                  {renderGroup("Earlier", getFilteredGroup(grouped.earlier))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
