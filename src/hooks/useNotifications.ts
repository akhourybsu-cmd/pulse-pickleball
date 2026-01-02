import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Notification {
  id: string;
  user_id: string;
  notification_type: string;
  category: string;
  priority: string;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  metadata: Record<string, unknown>;
  actor_id: string | null;
  expires_at: string | null;
  created_at: string;
  event_id?: string | null;
  event_type?: string | null;
}

export interface NotificationPreference {
  id: string;
  user_id: string;
  category: string;
  in_app_enabled: boolean;
  push_enabled: boolean;
  email_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
}

interface UseNotificationsOptions {
  showToasts?: boolean;
  categories?: string[];
}

export function useNotifications(userId: string | null | undefined, options: UseNotificationsOptions = {}) {
  const { showToasts = true, categories } = options;
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!userId) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    try {
      let query = supabase
        .from("user_notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (categories && categories.length > 0) {
        query = query.in("category", categories);
      }

      const { data, error } = await query;

      if (error) throw error;

      const mapped = (data || []).map((n): Notification => ({
        id: n.id,
        user_id: n.user_id,
        notification_type: n.notification_type,
        category: n.category || 'system',
        priority: n.priority || 'normal',
        title: n.title,
        message: n.message,
        link: n.link,
        read: n.read,
        metadata: (n.metadata as Record<string, unknown>) || {},
        actor_id: n.actor_id,
        expires_at: n.expires_at,
        created_at: n.created_at,
        event_id: n.event_id,
        event_type: n.event_type,
      }));

      setNotifications(mapped);
      setUnreadCount(mapped.filter(n => !n.read).length);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setLoading(false);
    }
  }, [userId, categories]);

  // Real-time subscription
  useEffect(() => {
    if (!userId) return;

    fetchNotifications();

    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newNotif = payload.new as Notification;
          
          // Add to beginning of list
          setNotifications(prev => [
            {
              ...newNotif,
              category: newNotif.category || 'system',
              priority: newNotif.priority || 'normal',
              metadata: (newNotif.metadata as Record<string, unknown>) || {},
            },
            ...prev
          ]);
          setUnreadCount(prev => prev + 1);

          // Show toast for high priority notifications
          if (showToasts && (newNotif.priority === 'urgent' || newNotif.priority === 'high')) {
            toast(newNotif.title, {
              description: newNotif.message,
              action: newNotif.link ? {
                label: "View",
                onClick: () => window.location.href = newNotif.link!,
              } : undefined,
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const updated = payload.new as Notification;
          setNotifications(prev => 
            prev.map(n => n.id === updated.id ? {
              ...updated,
              category: updated.category || 'system',
              priority: updated.priority || 'normal',
              metadata: (updated.metadata as Record<string, unknown>) || {},
            } : n)
          );
          // Recalculate unread count
          setNotifications(prev => {
            setUnreadCount(prev.filter(n => !n.read).length);
            return prev;
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'user_notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const deleted = payload.old as { id: string };
          setNotifications(prev => prev.filter(n => n.id !== deleted.id));
          setUnreadCount(prev => Math.max(0, prev - 1));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchNotifications, showToasts]);

  // Mark as read
  const markAsRead = useCallback(async (notificationId: string) => {
    const { error } = await supabase
      .from("user_notifications")
      .update({ read: true })
      .eq("id", notificationId);

    if (!error) {
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    if (!userId) return;

    const { error } = await supabase
      .from("user_notifications")
      .update({ read: true })
      .eq("user_id", userId)
      .eq("read", false);

    if (!error) {
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    }
  }, [userId]);

  // Delete notification
  const deleteNotification = useCallback(async (notificationId: string) => {
    const notif = notifications.find(n => n.id === notificationId);
    
    const { error } = await supabase
      .from("user_notifications")
      .delete()
      .eq("id", notificationId);

    if (!error) {
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      if (notif && !notif.read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    }
  }, [notifications]);

  // Clear all notifications
  const clearAll = useCallback(async () => {
    if (!userId) return;

    const { error } = await supabase
      .from("user_notifications")
      .delete()
      .eq("user_id", userId);

    if (!error) {
      setNotifications([]);
      setUnreadCount(0);
    }
  }, [userId]);

  // Get notifications by category
  const getByCategory = useCallback((category: string) => {
    return notifications.filter(n => n.category === category);
  }, [notifications]);

  // Group notifications by time
  const groupedByTime = useCallback(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    const groups: {
      today: Notification[];
      yesterday: Notification[];
      thisWeek: Notification[];
      earlier: Notification[];
    } = {
      today: [],
      yesterday: [],
      thisWeek: [],
      earlier: [],
    };

    notifications.forEach(n => {
      const date = new Date(n.created_at);
      if (date >= today) {
        groups.today.push(n);
      } else if (date >= yesterday) {
        groups.yesterday.push(n);
      } else if (date >= thisWeek) {
        groups.thisWeek.push(n);
      } else {
        groups.earlier.push(n);
      }
    });

    return groups;
  }, [notifications]);

  return {
    notifications,
    loading,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
    getByCategory,
    groupedByTime,
    refetch: fetchNotifications,
  };
}

// Hook for notification preferences
export function useNotificationPreferences(userId: string | null | undefined) {
  const [preferences, setPreferences] = useState<NotificationPreference[]>([]);
  const [loading, setLoading] = useState(true);

  const defaultCategories = ['matches', 'events', 'community', 'achievements', 'system'];

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const fetchPreferences = async () => {
      const { data, error } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", userId);

      if (error) {
        console.error("Error fetching preferences:", error);
      } else {
        setPreferences(data || []);
      }
      setLoading(false);
    };

    fetchPreferences();
  }, [userId]);

  const updatePreference = useCallback(async (
    category: string,
    updates: Partial<Pick<NotificationPreference, 'in_app_enabled' | 'push_enabled' | 'email_enabled'>>
  ) => {
    if (!userId) return;

    const existing = preferences.find(p => p.category === category);

    if (existing) {
      const { error } = await supabase
        .from("notification_preferences")
        .update(updates)
        .eq("id", existing.id);

      if (!error) {
        setPreferences(prev => 
          prev.map(p => p.id === existing.id ? { ...p, ...updates } : p)
        );
      }
    } else {
      const { data, error } = await supabase
        .from("notification_preferences")
        .insert({
          user_id: userId,
          category,
          ...updates,
        })
        .select()
        .single();

      if (!error && data) {
        setPreferences(prev => [...prev, data]);
      }
    }
  }, [userId, preferences]);

  const getPreference = useCallback((category: string): NotificationPreference | null => {
    return preferences.find(p => p.category === category) || null;
  }, [preferences]);

  const isEnabled = useCallback((category: string): boolean => {
    const pref = getPreference(category);
    return pref?.in_app_enabled ?? true; // Default to enabled
  }, [getPreference]);

  return {
    preferences,
    loading,
    updatePreference,
    getPreference,
    isEnabled,
    defaultCategories,
  };
}
