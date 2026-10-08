import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const ROUND_ROBIN_REFRESH_INTERVAL_MS = 15_000;
const CHANGE_BATCH_MS = 180;

/** Refresh data in place. Never remount the page or discard open tabs/forms. */
export function useRoundRobinLiveUpdates(
  eventId: string | undefined,
  userId: string | undefined,
  read: () => Promise<void>,
) {
  const [refreshing, setRefreshing] = useState(false);
  const refreshRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const refresh = useCallback(() => refreshRef.current(), []);

  useEffect(() => {
    if (!eventId || !userId) return;
    let active = true;
    let queued = false;
    let inFlight: Promise<void> | null = null;
    let changeTimer: ReturnType<typeof setTimeout> | undefined;
    const canRefresh = () => document.visibilityState === "visible" && navigator.onLine !== false;

    // A score save or round change during a read needs one trailing read;
    // sharing only the old promise could leave the newer result unseen.
    const requestRefresh = (): Promise<void> => {
      if (!active) return Promise.resolve();
      if (inFlight) {
        queued = true;
        return inFlight;
      }
      setRefreshing(true);
      inFlight = Promise.resolve().then(async () => {
        do {
          queued = false;
          if (!active) break;
          await read();
        } while (active && queued);
      }).catch((error: unknown) => {
        // The page handles read errors and retains the last saved snapshot.
        console.error("Round-robin update failed:", error);
      }).finally(() => {
        inFlight = null;
        if (active) setRefreshing(false);
      });
      return inFlight;
    };
    refreshRef.current = requestRefresh;
    const scheduleRefresh = () => {
      if (!active || !canRefresh() || changeTimer !== undefined) return;
      // Rebuilds emit one notification per row. Fetch one complete snapshot.
      changeTimer = setTimeout(() => {
        changeTimer = undefined;
        if (canRefresh()) void requestRefresh();
      }, CHANGE_BATCH_MS);
    };

    void requestRefresh();
    const channel = supabase.channel(`round-robin-changes-${eventId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "round_robin_events", filter: `id=eq.${eventId}` }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "round_robin_schedule", filter: `event_id=eq.${eventId}` }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "round_robin_players", filter: `event_id=eq.${eventId}` }, scheduleRefresh)
      .subscribe((status) => {
        // Catch changes between the initial read and subscription, and while
        // disconnected. Polling below also covers silently missed messages.
        if (status === "SUBSCRIBED") scheduleRefresh();
      });
    const poll = setInterval(() => {
      if (!inFlight) scheduleRefresh();
    }, ROUND_ROBIN_REFRESH_INTERVAL_MS);
    document.addEventListener("visibilitychange", scheduleRefresh);
    window.addEventListener("focus", scheduleRefresh);
    window.addEventListener("online", scheduleRefresh);

    return () => {
      active = false;
      refreshRef.current = () => Promise.resolve();
      clearTimeout(changeTimer);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", scheduleRefresh);
      window.removeEventListener("focus", scheduleRefresh);
      window.removeEventListener("online", scheduleRefresh);
      void supabase.removeChannel(channel);
    };
  }, [eventId, userId, read]);

  return { refresh, refreshing };
}
