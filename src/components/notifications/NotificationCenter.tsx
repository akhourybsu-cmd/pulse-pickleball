import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Bell,
  CheckCheck,
  Trash2,
  Settings,
  Target,
  Calendar,
  Users,
  Award,
  Undo2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
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
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { NotificationItem } from "./NotificationItem";
import type { Notification } from "@/hooks/useNotifications";

interface NotificationCenterProps {
  isOpen: boolean;
  notifications: Notification[];
  unreadCount: number;
  /** True while the initial notification fetch is in flight. Drives the
   *  skeleton state inside the active tab body so opening the bell before
   *  the fetch settles doesn't show a misleading "all caught up" message. */
  loading?: boolean;
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
  onUndo?: (notification: Notification) => void;
}

// Tournament category dropped during the player-only beta — tournament
// notification types still exist in the DB schema but no longer surface
// as a tab here.
const categories = [
  { value: "all", label: "All", icon: Bell },
  { value: "matches", label: "Matches", icon: Target },
  { value: "events", label: "Events", icon: Calendar },
  { value: "community", label: "Social", icon: Users },
  { value: "achievements", label: "Awards", icon: Award },
];

// Category-specific empty state content
const emptyStates: Record<string, { icon: React.ElementType; title: string; message: string }> = {
  all: { icon: Bell, title: "No notifications", message: "You're all caught up!" },
  matches: { icon: Target, title: "No match notifications", message: "Your match updates will appear here" },
  events: { icon: Calendar, title: "No event notifications", message: "Event reminders will show up here" },
  community: { icon: Users, title: "No community activity", message: "Join groups to see activity here" },
  achievements: { icon: Award, title: "No achievements yet", message: "Play matches to earn badges!" },
};

export function NotificationCenter({
  isOpen,
  notifications,
  unreadCount,
  loading = false,
  groupedByTime,
  onClose,
  onMarkAsRead,
  onMarkAllAsRead,
  onDelete,
  onClearAll,
  onUndo,
}: NotificationCenterProps) {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState("all");
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [recentlyDeleted, setRecentlyDeleted] = useState<Notification | null>(null);

  const handleSelect = useCallback(async (notificationId: string) => {
    const notification = notifications.find(n => n.id === notificationId);
    if (!notification) return;

    await onMarkAsRead(notificationId);
    onClose();
    
    if (notification.link) {
      navigate(notification.link);
      
      // Handle special actions in metadata
      const action = notification.metadata?.action as string | undefined;
      if (action) {
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent(`notification-action-${action}`, {
            detail: notification.metadata
          }));
        }, 100);
      }
    }
  }, [notifications, onMarkAsRead, onClose, navigate]);

  const handleDelete = useCallback((id: string) => {
    const notification = notifications.find(n => n.id === id);
    if (notification) {
      setRecentlyDeleted(notification);
      onDelete(id);
      
      // Show undo toast
      toast("Notification dismissed", {
        action: {
          label: "Undo",
          onClick: () => {
            if (onUndo && notification) {
              onUndo(notification);
            }
          },
        },
        duration: 5000,
      });
    }
  }, [notifications, onDelete, onUndo]);

  const handleClearAll = useCallback(() => {
    onClearAll();
    setShowClearDialog(false);
    toast("All notifications cleared");
  }, [onClearAll]);

  // Get count by category
  const getCategoryCount = (category: string) => {
    if (category === "all") {
      return notifications.filter(n => !n.read).length;
    }
    return notifications.filter(n => n.category === category && !n.read).length;
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
        <h3 className="text-xs font-medium text-muted-foreground px-3 py-2 sticky top-0 bg-background/95 backdrop-blur-sm z-10">
          {title}
        </h3>
        <AnimatePresence mode="popLayout">
          {items.map(notification => (
            <motion.div
              key={notification.id}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="group"
            >
              <NotificationItem
                notification={notification}
                onSelect={handleSelect}
                onDismiss={handleDelete}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    );
  };

  const currentEmptyState = emptyStates[activeCategory] || emptyStates.all;
  const EmptyIcon = currentEmptyState.icon;

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: isOpen ? 1 : 0 }}
        transition={{ duration: 0.2 }}
        className={cn(
          "fixed inset-0 bg-background/80 backdrop-blur-sm z-50",
          !isOpen && "pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Drawer */}
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: isOpen ? 0 : "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="fixed top-0 right-0 h-full w-full sm:w-[420px] bg-background border-l shadow-xl z-50"
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
          <div className="border-b overflow-x-auto">
            <TabsList className="h-11 w-max min-w-full justify-start bg-transparent gap-0.5 px-2">
              {categories.map(cat => {
                const count = getCategoryCount(cat.value);
                const CatIcon = cat.icon;
                
                return (
                  <TabsTrigger
                    key={cat.value}
                    value={cat.value}
                    className="text-xs px-3 py-1.5 gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-full whitespace-nowrap"
                  >
                    <CatIcon className="h-3.5 w-3.5" />
                    {cat.label}
                    {count > 0 && (
                      <span className="ml-1 text-[10px] opacity-80">({count})</span>
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
              onClick={() => setShowClearDialog(true)}
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
              {loading && notifications.length === 0 ? (
                /* Initial fetch still in flight — show a skeleton so the
                   tab body doesn't briefly render the "all caught up"
                   empty state before notifications arrive. */
                <div className="p-3 space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-start gap-3 p-3">
                      <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-3.5 w-2/3" />
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-2.5 w-16" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredNotifications.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center justify-center py-16 px-4 text-center"
                >
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <EmptyIcon className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-medium text-muted-foreground">{currentEmptyState.title}</h3>
                  <p className="text-sm text-muted-foreground/70 mt-1 max-w-[250px]">
                    {currentEmptyState.message}
                  </p>
                </motion.div>
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
      </motion.div>

      {/* Clear All Confirmation Dialog */}
      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all notifications?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all {notifications.length} notifications. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearAll} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Clear All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
