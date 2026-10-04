import { useQuery, useQueryClient } from '@tanstack/react-query';
import { withAuthDeadline } from '@/lib/authDeadline';
import { useState, useEffect, useCallback, useRef, useId, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useActiveView } from "@/contexts/ActiveViewContext";

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
  dismissed_at?: string | null;
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
  /** Fetch full notification rows only when their panel is visible. */
  loadDetails?: boolean;
}

export function useNotifications(
  userId: string | null | undefined,
  options: UseNotificationsOptions = {},
) {
  const { showToasts = true, loadDetails = true } = options;
  const categoryKey = JSON.stringify([...(options.categories ?? [])].sort());
  const { isContextActive } = useActiveView();
  const channelId = useId();
  const sequence = useRef(0);
  const scope = JSON.stringify([userId, categoryKey, loadDetails]);
  const currentScope = useRef(scope);
  currentScope.current = scope;
  const [state, setState] = useState<{
    userId: typeof userId;
    rows: Notification[];
    count: number;
  }>({ userId, rows: [], count: 0 });
  const [loading, setLoading] = useState(true);
  const notifications = state.userId === userId ? state.rows : [];
  const unreadCount = state.userId === userId ? state.count : 0;
  const fetchNotifications = useCallback(async () => {
    if (currentScope.current !== scope) return;
    const request = ++sequence.current;
    if (!userId) {
      setState({ userId, rows: [], count: 0 });
      setLoading(false);
      return;
    }
    const categories = JSON.parse(categoryKey) as string[];
    const selectNotifications = (head = false) =>
      supabase
        .from("user_notifications")
        .select("*", { count: head ? "exact" : undefined, head });
    const visible = (query: ReturnType<typeof selectNotifications>) => {
      query = query
        .eq("user_id", userId)
        .is("dismissed_at", null)
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
      return categories.length ? query.in("category", categories) : query;
    };
    try {
      let rows: Notification[] = [];
      if (loadDetails) {
        const { data, error } = await visible(selectNotifications())
          .order("created_at", { ascending: false })
          .limit(100);
        if (error) throw error;
        rows = (data ?? []).map((n) => ({
          ...n,
          category: n.category || "system",
          priority: n.priority || "normal",
          metadata: (n.metadata || {}) as Record<string, unknown>,
        }));
        const ids = rows
          .filter((n) => !n.read && isContextActive(n))
          .map((n) => n.id);
        if (ids.length) {
          const { data: readRows, error: readError } = await supabase
            .from("user_notifications")
            .update({ read: true })
            .eq("user_id", userId)
            .eq("read", false)
            .in("id", ids)
            .select("id");
          if (!readError) {
            const saved = new Set(readRows?.map((n) => n.id));
            rows = rows.map((n) =>
              saved.has(n.id) ? { ...n, read: true } : n,
            );
          }
        }
      }
      const { count, error } = await visible(selectNotifications(true)).eq(
        "read",
        false,
      );
      if (error) throw error;
      if (request === sequence.current && currentScope.current === scope)
        setState({ userId, rows, count: count ?? 0 });
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      if (request === sequence.current && currentScope.current === scope)
        setLoading(false);
    }
  }, [userId, categoryKey, isContextActive, loadDetails, scope]);
  useEffect(() => {
    setLoading(true);
    void fetchNotifications();
    if (!userId) return;
    const channel = supabase
      .channel(`notifications-${channelId}-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const n = payload.new as Notification;
          const categories = JSON.parse(categoryKey) as string[];
          const visible =
            payload.eventType === "INSERT" &&
            !n.read &&
            !n.dismissed_at &&
            (!n.expires_at || Date.parse(n.expires_at) > Date.now()) &&
            (!categories.length || categories.includes(n.category));
          if (visible && isContextActive(n)) {
            // Supabase query builders are lazy: execute and observe the write.
            void (async () => {
              const { error } = await supabase
                .from("user_notifications")
                .update({ read: true })
                .eq("user_id", userId)
                .eq("id", n.id)
                .eq("read", false);
              if (error)
                console.warn("Notification acknowledgement failed", error);
              await fetchNotifications();
            })();
          } else {
            if (
              visible &&
              showToasts &&
              ["urgent", "high"].includes(n.priority)
            )
              toast(n.title, {
                description: n.message,
                action: n.link
                  ? {
                      label: "View",
                      onClick: () => {
                        window.location.href = n.link!;
                      },
                    }
                  : undefined,
              });
            void fetchNotifications();
          }
        },
      )
      .subscribe();
    const refresh = () => void fetchNotifications();
    window.addEventListener("focus", refresh);
    return () => {
      sequence.current++;
      window.removeEventListener("focus", refresh);
      void supabase.removeChannel(channel);
    };
  }, [
    userId,
    channelId,
    categoryKey,
    fetchNotifications,
    isContextActive,
    showToasts,
  ]);
  const change = useCallback(
    async (
      updates: { read?: boolean; dismissed_at?: string | null },
      id?: string,
      unreadOnly = false,
    ) => {
      if (!userId) return false;
      try {
        let query = supabase
          .from("user_notifications")
          .update(updates)
          .eq("user_id", userId);
        if (id) query = query.eq("id", id);
        else query = query.is("dismissed_at", null);
        if (unreadOnly) query = query.eq("read", false);
        const { data, error } = await query.select("id");
        if (error) throw error;
        if (id && !data?.length)
          throw new Error("This notification is no longer available.");
        await fetchNotifications();
        return true;
      } catch (error) {
        toast.error("Notification change was not saved. Please try again.");
        console.error(error);
        return false;
      }
    },
    [userId, fetchNotifications],
  );
  const markAsRead = useCallback(
    (id: string) => change({ read: true }, id),
    [change],
  );
  const markAllAsRead = useCallback(
    () => change({ read: true }, undefined, true),
    [change],
  );
  const deleteNotification = useCallback(
    (id: string) => change({ dismissed_at: new Date().toISOString() }, id),
    [change],
  );
  const clearAll = useCallback(
    () => change({ dismissed_at: new Date().toISOString() }),
    [change],
  );
  const restoreNotification = useCallback(
    (notification: Notification) =>
      change({ dismissed_at: null }, notification.id),
    [change],
  );
  // Get notifications by category
  const getByCategory = useCallback(
    (category: string) => {
      return notifications.filter((n) => n.category === category);
    },
    [notifications],
  );

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

    notifications.forEach((n) => {
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
    restoreNotification,
    getByCategory,
    groupedByTime,
    refetch: fetchNotifications,
  };
}

// Preferences are account-scoped and report failed saves instead of silently reverting.
export function useNotificationPreferences(userId: string | null | undefined) {
  const client = useQueryClient();
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const query = useQuery({
    queryKey: ['notification-preferences', userId],
    enabled: !!userId,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
    queryFn: async () => {
      const { data, error } = await withAuthDeadline(signal => supabase
        .from('notification_preferences').select('*').eq('user_id', userId!).abortSignal(signal));
      if (error) throw error;
      return data ?? [];
    },
  });
  const preferences = useMemo(() => query.data ?? [], [query.data]);
  const updatePreference = useCallback(
    async (
      category: string,
      updates: Partial<
        Pick<
          NotificationPreference,
          "in_app_enabled" | "push_enabled" | "email_enabled"
        >
      >,
    ) => {
      if (!userId || savingRef.current || !query.data || query.isError) return false;
      savingRef.current = true;
      setSaving(true);
      try {
        const { data, error } = await withAuthDeadline(signal => supabase
          .from("notification_preferences")
          .upsert(
            { user_id: userId, category, ...updates },
            { onConflict: "user_id,category" },
          )
          .select()
          .abortSignal(signal)
          .single());
        if (error) throw error;
        if (!data) throw new Error('Preference was not confirmed.');
        client.setQueryData<NotificationPreference[]>(['notification-preferences', userId], old => [
          ...(old ?? []).filter(p => p.category !== category), data,
        ]);
        return true;
      } catch (error) {
        toast.error("Notification preference was not saved. Please try again.");
        console.error(error);
        return false;
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
    },
    [userId, client, query.data, query.isError],
  );
  const getPreference = useCallback(
    (category: string) =>
      preferences.find((p) => p.category === category) || null,
    [preferences],
  );
  return {
    preferences,
    loading: !!userId && query.isLoading,
    error: query.isError,
    refetch: query.refetch,
    saving,
    updatePreference,
    getPreference,
    isEnabled: (category: string) =>
      getPreference(category)?.in_app_enabled ?? true,
    defaultCategories: [
      "matches",
      "leagues",
      "events",
      "messages",
      "community",
      "achievements",
      "system",
    ],
  };
}
